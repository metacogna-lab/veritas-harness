/**
 * Default job executors (Feature 2) — wrap the EXISTING ControlPlane / ingest pipeline
 * so autonomous jobs run the exact same safe loop as the CLI/API. The provider is
 * resolved once at job start from config; recorded in the result.
 */
import { ControlPlane, PlanEvalError } from "../control/plane.ts";
import type { LLMBackbone } from "../llm/index.ts";
import type { MissionStore } from "../control/store.ts";
import type { EventBus } from "../telemetry/index.ts";
import { loadResearchPlan } from "../resources/research-plan.ts";
import type { MissionExecutor, IngestExecutor } from "./types.ts";

export interface ExecutorDeps {
  buildLLM: () => LLMBackbone;
  store: MissionStore;
  bus?: EventBus;
}

/**
 * Build the mission executor. Maps ControlPlane outcomes to job outcomes:
 *   answered/max_steps → completed · error → error.
 * A mission requesting a terminal-action release surfaces `needs_release` (the runner
 * turns that into `held`). The example loadouts are read-only, so this path is exercised
 * by terminal-action loadouts and pinned by the runner's invariant test.
 */
export function makeMissionExecutor(deps: ExecutorDeps): MissionExecutor {
  return async (spec) => {
    try {
      const plane = new ControlPlane({ llm: deps.buildLLM(), store: deps.store, bus: deps.bus });
      const input = spec.plan
        ? { plan: spec.plan, loadout: spec.loadout, maxSteps: spec.maxSteps }
        : spec.planPath
          ? { plan: loadResearchPlan(spec.planPath), loadout: spec.loadout, maxSteps: spec.maxSteps }
          : undefined;
      if (!input) return { outcome: "error", error: "mission job needs plan or planPath" };

      const { id, result } = await plane.start(input as never);
      if (result.status === "error") return { outcome: "error", error: result.error ?? "mission error" };
      return { outcome: "completed", result: { missionId: id, status: result.status } };
    } catch (err) {
      if (err instanceof PlanEvalError) return { outcome: "error", error: `dogma gate: ${err.message}` };
      return { outcome: "error", error: (err as Error).message };
    }
  };
}

/** Build the ingest executor (runIngest is imported lazily to keep this module light). */
export function makeIngestExecutor(deps: ExecutorDeps, missionsDir: string): IngestExecutor {
  return async (spec) => {
    const { runIngest } = await import("../ingest/ingest.ts");
    const { buildSyntheticBrief } = await import("../ingest/brief.ts");
    const { plan, outputPath } = await runIngest({
      inputPath: `job-${spec.slug}.md`,
      syntheticContent: buildSyntheticBrief({ slug: spec.slug, objective: spec.objective, target: spec.target }),
      slug: spec.slug,
      harnessRoot: missionsDir,
      llm: deps.buildLLM(),
    });
    return { slug: spec.slug, planPath: outputPath, objective: plan.objective };
  };
}
