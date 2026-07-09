/**
 * Load and validate research-plan.json; bridge to control-plane StartOptions.
 */
import { readFileSync } from "node:fs";
import { researchPlanSchema, type ResearchPlan } from "../../../../ingest/src/schema.ts";
import type { MissionScope } from "../safety/scope.ts";
export type { ResearchPlan };

export interface PlanStartMapping {
  objective: string;
  loadout: string;
  target: string;
  role?: string;
  scope: MissionScope;
  planNote: string;
}

/** Load and Zod-validate a research-plan.json file from disk. */
export function loadResearchPlan(path: string): ResearchPlan {
  const raw = readFileSync(path, "utf8");
  const json: unknown = JSON.parse(raw);
  const parsed = researchPlanSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`invalid research plan at ${path}: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** Map a validated plan to control-plane start fields. */
export function planToStartOptions(plan: ResearchPlan): PlanStartMapping {
  const role = plan.specialists[0]?.role;
  const phaseSummary = plan.phases.map((p) => `${p.id}: ${p.description}`).join("; ");
  const planNote =
    `research-plan slug=${plan.metadata.slug} | phases: ${phaseSummary} | ` +
    `success: ${plan.successCriteria.join("; ")}`;

  return {
    objective: plan.objective,
    loadout: plan.loadout,
    target: plan.target,
    role,
    scope: { ...plan.scope },
    planNote,
  };
}
