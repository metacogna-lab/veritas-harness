/**
 * Verification plane — provenance/evidence gate (invariant #3: provenance before claim).
 *
 * A finding is accepted only if a REAL successful tool observation backs it. A
 * finding whose `evidenceRef` names no successful observation in the mission log
 * is a confabulation and is rejected. Pure — takes the log, returns a decision.
 */
import type { Observation } from "../mission/index.ts";

export interface FindingDraft {
  claim: string;
  /** The name of the tool whose observation supports the claim. */
  evidenceRef: string;
}

export type GateDecision = { ok: true } | { ok: false; reason: string };

export function evidenceGate(finding: FindingDraft, log: readonly Observation[]): GateDecision {
  const backed = log.some((o) => o.ok && o.toolName === finding.evidenceRef);
  if (!backed) {
    return { ok: false, reason: `PROVENANCE DENIED: no successful observation from "${finding.evidenceRef}"` };
  }
  return { ok: true };
}
