/**
 * The surfaces the RSI proposer is permitted to edit (veritas-v0.2 H-5).
 *
 * Two tiers: harness-local code, and the repo-shared base-scripts. base-scripts run
 * in EVERY harness, so an edit there has a larger blast radius — which means the
 * human release gate on those edits matters MORE, not less (invariant #5). Nothing
 * here changes the cadence contract: telemetry is emitted at runtime, proposals are
 * made asynchronously, and application is ALWAYS human-released. "Improve base-scripts
 * at runtime" means "observe at runtime, propose out-of-band, apply only via a human".
 */
import type { EditableSurface } from "./types.ts";

/** Harness-local editable surfaces (scoped to this harness only). */
export const HARNESS_EDITABLE_SURFACES: EditableSurface[] = [
  { path: "src/safety/scope.ts", rationale: "scope decisions live here" },
  { path: "src/agent/specialists.ts", rationale: "specialist prompts + tool allowlists" },
  { path: "src/tools/registry.ts", rationale: "tool registration + risk tiers" },
];

/**
 * Repo-shared base-scripts. Edits here affect every harness in the repo, so they are
 * flagged higher-risk; the apply gate (requireHumanRelease) is non-negotiable for them.
 */
export const BASE_SCRIPT_EDITABLE_SURFACES: EditableSurface[] = [
  {
    path: "../../base-scripts/doctor.mjs",
    rationale: "shared env healthcheck — runs in EVERY harness (higher blast radius; human gate mandatory)",
  },
  {
    path: "../../base-scripts/veritas-config.mjs",
    rationale: "shared config wizard — shared across harnesses (human gate mandatory)",
  },
  {
    path: "../../base-scripts/lib/stats.mjs",
    rationale: "shared stats used by bench + verify-claims (human gate mandatory)",
  },
];

/** The full default surface set the RSI loop proposes against. */
export const DEFAULT_EDITABLE_SURFACES: EditableSurface[] = [
  ...HARNESS_EDITABLE_SURFACES,
  ...BASE_SCRIPT_EDITABLE_SURFACES,
];

/** True iff a surface path points at repo-shared base-scripts (used for gate-tier checks). */
export function isBaseScriptSurface(path: string): boolean {
  return path.includes("base-scripts/");
}
