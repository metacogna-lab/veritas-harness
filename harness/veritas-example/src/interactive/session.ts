/**
 * Interactive shell session — mutable draft plan + staged sources + mission ids.
 */
import type { ResearchPlan, PlanSource } from "../ingest/schema.ts";
import type { PlanEvalResult } from "../resources/plan-eval.ts";

/** Turn in the conversational planner history. */
export interface PlannerTurn {
  role: "user" | "assistant";
  content: string;
}

/** Mutable state for one interactive shell session. */
export interface InteractiveSession {
  slug?: string;
  draft?: ResearchPlan;
  stagedSources: PlanSource[];
  lastEval?: PlanEvalResult;
  planPath?: string;
  activeMissionId?: string;
  history: PlannerTurn[];
}

/** Create an empty interactive session. */
export function createSession(): InteractiveSession {
  return { stagedSources: [], history: [] };
}

/** Reset draft/eval/history while keeping the session object identity. */
export function clearSession(session: InteractiveSession): void {
  session.slug = undefined;
  session.draft = undefined;
  session.stagedSources = [];
  session.lastEval = undefined;
  session.planPath = undefined;
  session.activeMissionId = undefined;
  session.history = [];
}

/** Pretty one-screen summary of the current draft (not raw JSON). */
export function summarizeDraft(session: InteractiveSession): string {
  if (!session.draft) {
    return "No draft yet. Describe a research objective, or use /ingest <path>.";
  }
  const p = session.draft;
  const lines = [
    `slug:       ${p.metadata.slug}`,
    `objective:  ${p.objective}`,
    `loadout:    ${p.loadout}`,
    `target:     ${p.target}`,
    `phases:     ${p.phases.map((ph) => ph.id).join(", ")}`,
    `criteria:   ${p.successCriteria.length}`,
    `sources:    ${p.sources.length}`,
    `specialists:${p.specialists.map((s) => s.role).join(", ")}`,
  ];
  if (session.planPath) lines.push(`written:    ${session.planPath}`);
  if (session.lastEval) {
    lines.push(
      `dogma:      ${session.lastEval.pass ? "PASS" : "FAIL"} (${Math.round(session.lastEval.score * 100)}%)`,
    );
  }
  return lines.join("\n");
}
