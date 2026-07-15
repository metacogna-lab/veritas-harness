/**
 * HTTP API app builder (Feature 1). `createApp(deps)` returns a hono app that adapts
 * the EXISTING ControlPlane / ingest pipeline / MissionStore to HTTP — never a new
 * execution path (invariant #8). Behaviour is provider-dependent: LLMs are built from
 * the injected provider chain, so switching HARNESS_PROVIDER changes the API with no
 * code change. Every side-effecting mission still runs the full safety spine.
 *
 * Pure builder: no socket, no process state — unit-testable via `app.request(...)`.
 */
import { Hono } from "hono";
import { z } from "zod";
import { ControlPlane, PlanEvalError } from "../control/plane.ts";
import { redact } from "../config/index.ts";
import { runIngest } from "../ingest/ingest.ts";
import { buildSyntheticBrief } from "../ingest/brief.ts";
import { evalPlanWithConfig } from "../resources/plan-eval.ts";
import { defaultLoadouts } from "../agent/loadouts.ts";
import { loadResearchPlan } from "../resources/research-plan.ts";
import { streamMissionEvents, SSE_HEADERS } from "./sse.ts";
import type { ServerDeps } from "./deps.ts";

const ingestSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, "slug must be [a-z0-9-]+"),
  objective: z.string().min(1),
  target: z.string().optional(),
  loadout: z.enum(["codebase-audit", "research", "web-recon"]).optional(),
});

const startSchema = z.object({
  planPath: z.string().optional(),
  objective: z.string().optional(),
  target: z.string().optional(),
  loadout: z.string().optional(),
  maxSteps: z.number().int().positive().optional(),
});

function err(c: import("hono").Context, status: number, message: string) {
  return c.json({ ok: false, error: message }, status as never);
}

export function createApp(deps: ServerDeps): Hono {
  const app = new Hono();
  const providerView = () => {
    const p = deps.config.providers[0];
    return {
      provider: deps.config.defaultProvider,
      model: p?.model,
      chain: redact(deps.config.providers).map((x) => ({ provider: x.provider, model: x.model })),
    };
  };
  const newPlane = () => new ControlPlane({ llm: deps.buildLLM(), store: deps.store, bus: deps.bus });

  // ── health & provider ─────────────────────────────────────────────────────
  app.get("/health", (c) =>
    c.json({ ok: true, status: "healthy", db: Boolean(deps.db), ...providerView() }),
  );
  app.get("/v1/provider", (c) => c.json({ ok: true, ...providerView() }));
  app.get("/v1/loadouts", (c) =>
    c.json({ ok: true, loadouts: defaultLoadouts().list().map((l) => ({ name: l.name, description: l.description })) }),
  );

  // ── ingest (provider-dependent compile + dogma gate) ────────────────────────
  app.post("/v1/ingest", async (c) => {
    const parsed = ingestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return err(c, 400, parsed.error.issues.map((i) => i.message).join("; "));
    const { slug, objective, target } = parsed.data;
    try {
      const syntheticContent = buildSyntheticBrief({ slug, objective, target });
      const { plan, outputPath } = await runIngest({
        inputPath: `api-${slug}.md`,
        syntheticContent,
        slug,
        harnessRoot: deps.missionsDir,
        llm: deps.buildLLM(),
      });
      const evalResult = evalPlanWithConfig(plan);
      if (!evalResult.pass) {
        return c.json(
          { ok: false, error: "plan failed the Dogma Gate", violations: evalResult.dimensions.filter((d) => d.required && !d.pass) },
          400,
        );
      }
      return c.json({ ok: true, slug, plan, planPath: outputPath, score: evalResult.score, dimensions: evalResult.dimensions });
    } catch (e) {
      return err(c, 422, `ingest failed: ${(e as Error).message}`);
    }
  });

  // ── missions ────────────────────────────────────────────────────────────────
  app.post("/v1/missions", async (c) => {
    const parsed = startSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return err(c, 400, parsed.error.issues.map((i) => i.message).join("; "));
    const isAsync = c.req.query("async") === "true";
    const { planPath, objective, target, loadout, maxSteps } = parsed.data;

    // Async → enqueue a job (Feature 2). Requires a queue to be wired.
    if (isAsync) {
      if (!deps.queue) return err(c, 400, "async requested but no job queue is configured");
      const job = await deps.queue.enqueueMission({ planPath });
      return c.json({ ok: true, jobId: job.id, status: "queued" }, 202);
    }

    try {
      const plane = newPlane();
      const input = planPath
        ? { plan: loadResearchPlan(planPath), loadout, maxSteps }
        : objective && target
          ? { objective, target, loadout, maxSteps }
          : undefined;
      if (!input) return err(c, 400, "provide planPath OR objective+target");
      const { id, result } = await plane.start(input as never);
      return c.json({ ok: true, id, status: result.status });
    } catch (e) {
      if (e instanceof PlanEvalError) return err(c, 422, e.message);
      return err(c, 500, (e as Error).message);
    }
  });

  app.get("/v1/missions/:id", (c) => {
    const status = new ControlPlane({ llm: deps.buildLLM(), store: deps.store }).status(c.req.param("id"));
    if (!status) return err(c, 404, `unknown mission ${c.req.param("id")}`);
    return c.json({ ok: true, id: c.req.param("id"), status });
  });

  app.get("/v1/missions/:id/report", (c) => {
    const report = new ControlPlane({ llm: deps.buildLLM(), store: deps.store }).report(c.req.param("id"));
    if (!report) return err(c, 404, `unknown mission ${c.req.param("id")}`);
    return c.json({ ok: true, id: c.req.param("id"), report });
  });

  app.get("/v1/missions/:id/events", (c) => {
    if (!deps.bus) return err(c, 400, "telemetry bus not configured");
    return new Response(streamMissionEvents(deps.bus, c.req.param("id")), { headers: SSE_HEADERS });
  });

  return app;
}
