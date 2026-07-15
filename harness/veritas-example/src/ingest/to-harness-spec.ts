/**
 * Intent → HarnessSpec bridge (H-4). Maps a ResearchPlan into meta's IngestedIntent
 * and delegates to deriveHarnessSpec. Creation stays in meta/create-harness; this only
 * produces the JSON contract for `create-harness --from-spec`.
 */
import { deriveHarnessSpec, type HarnessSpec, type IngestedIntent } from "../../../../meta/harness-spec.ts";
import type { ResearchPlan } from "./schema.ts";

/** Lift a research plan into the structural intent meta needs (no schema import there). */
export function planToIngestedIntent(plan: ResearchPlan, capabilities?: string[]): IngestedIntent {
  return {
    slug: plan.metadata.slug,
    loadout: plan.loadout,
    specialists: plan.specialists.map((s) => ({ role: s.role, focus: s.focus })),
    scope: { hosts: [...plan.scope.hosts], paths: [...plan.scope.paths] },
    capabilities: capabilities ?? ["research"],
  };
}

/** Derive a HarnessSpec from an ingested research plan (calls meta; no scaffold here). */
export function researchPlanToHarnessSpec(plan: ResearchPlan, capabilities?: string[]): HarnessSpec {
  return deriveHarnessSpec(planToIngestedIntent(plan, capabilities));
}
