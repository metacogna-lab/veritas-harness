/**
 * POST /api/v1/missions
 *
 * STEP 1: Accept a research intention (multipart/form-data or JSON),
 * compile it into a ResearchPlan via the Anthropic SDK, run the 8-dimension
 * Dogma Gate, and return the validated plan or structured violations.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { serverCompileBrief } from "@/lib/compile-brief";
import { evalPlanWithConfig } from "@/lib/veritas/eval";
import type { ApiIngestResult } from "@/lib/veritas/types";

const payloadSchema = z.object({
  slug: z
    .string()
    .min(1, "Mission name is required")
    .regex(/^[a-z0-9-]+$/, "Use only lowercase letters, numbers, and hyphens"),
  objective: z.string().min(1, "Objective is required"),
  target: z.string().optional(),
  loadout: z.enum(["codebase-audit", "research", "web-recon"]).optional(),
});

export async function POST(req: Request): Promise<NextResponse<ApiIngestResult>> {
  try {
    // Support both multipart/form-data (browser form) and application/json (CLI)
    let rawPayload: Record<string, string>;
    let fileContent: string | undefined;
    let fileName: string | undefined;

    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      rawPayload = {
        slug: (form.get("slug") as string) ?? "",
        objective: (form.get("objective") as string) ?? "",
        target: (form.get("target") as string) ?? "",
        loadout: (form.get("loadout") as string) ?? "",
      };
      const file = form.get("file");
      if (file instanceof File && file.size > 0) {
        // Only support text-based files in Phase 1 (PDF extraction is Phase 2)
        if (file.name.endsWith(".pdf")) {
          return NextResponse.json(
            { ok: false, error: "PDF uploads are not supported in Phase 1. Convert to .md or .txt." },
            { status: 400 },
          );
        }
        fileContent = await file.text();
        fileName = file.name;
      }
    } else {
      rawPayload = await req.json();
    }

    // Validate required fields
    const validated = payloadSchema.safeParse(rawPayload);
    if (!validated.success) {
      const errors = validated.error.issues.map((i) => i.message).join("; ");
      return NextResponse.json({ ok: false, error: errors }, { status: 400 });
    }

    const { slug, objective, target, loadout } = validated.data;

    // Compile brief → ResearchPlan via LLM
    let plan;
    try {
      plan = await serverCompileBrief({
        slug,
        objective,
        target: target || undefined,
        loadout: loadout || "research",
        fileContent,
        fileName,
      });
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: `Plan compilation failed: ${(err as Error).message}` },
        { status: 422 },
      );
    }

    // Dogma Gate — 8 dimensions
    const evalResult = evalPlanWithConfig(plan);

    if (!evalResult.pass) {
      const violations = evalResult.dimensions.filter((d) => d.required && !d.pass);
      return NextResponse.json(
        {
          ok: false,
          error: "Research plan failed the Dogma Gate. Fix the violations and resubmit.",
          violations,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      slug,
      plan,
      score: evalResult.score,
      dimensions: evalResult.dimensions,
    });
  } catch (err) {
    console.error("[POST /api/v1/missions]", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
