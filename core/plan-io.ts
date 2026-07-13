/**
 * Plan persistence at the ingest→execution seam (veritas-v0.2 H-1).
 *
 * The browser compiles a ResearchPlan; without persistence it is discarded and the
 * CLI recompiles from scratch. `writePlan` makes the compiled plan BECOME the file
 * the harness runs (`missions/<slug>/research-plan.json`) — no recompilation across
 * the seam. `loadPlan` is the validating read used by any consumer.
 *
 * Node-compatible (node:fs); the app writes only when an operator points it at a
 * harness-visible missions directory via VERITAS_MISSIONS_DIR.
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { researchPlanSchema, type ResearchPlan } from "./schema";

/**
 * Write a validated plan to `<missionsDir>/<slug>/research-plan.json`.
 * The plan is re-validated before writing so a malformed object never lands on disk.
 * Returns the absolute-or-relative path written.
 */
export function writePlan(missionsDir: string, plan: ResearchPlan): string {
  const parsed = researchPlanSchema.safeParse(plan);
  if (!parsed.success) {
    throw new Error(`writePlan: refusing to write invalid plan: ${parsed.error.message}`);
  }
  const slug = parsed.data.metadata.slug;
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(`writePlan: unsafe slug "${slug}" — expected [a-z0-9-]+`);
  }
  const dir = join(missionsDir, slug);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "research-plan.json");
  writeFileSync(path, JSON.stringify(parsed.data, null, 2) + "\n", "utf8");
  return path;
}

/** Read and Zod-validate a research-plan.json from disk. */
export function loadPlan(path: string): ResearchPlan {
  const raw = readFileSync(path, "utf8");
  const json: unknown = JSON.parse(raw);
  const parsed = researchPlanSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`loadPlan: invalid research plan at ${path}: ${parsed.error.message}`);
  }
  return parsed.data;
}
