/**
 * Stage 1 — weakness mining. Cluster mission failures into failure patterns
 * GROUNDED BY THE VERIFIER: only failures that carry provenance (an evidenceRef
 * pointing at a real observation) are admitted, because an ungrounded "failure" is
 * itself a confabulation (invariant #3). Different causal states can share a
 * surface error, so members retain their causal state for the proposer to inspect.
 */
import type { FailureObservation, FailurePattern } from "./types.ts";

/** Normalize a terminal cause into a stable cluster signature. */
export function signatureOf(terminalCause: string): string {
  return terminalCause
    .toLowerCase()
    .replace(/"[^"]*"/g, "")
    .replace(/[0-9]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cluster grounded failures by signature, ranked by frequency (desc). Ungrounded
 * failures (no evidenceRef) are dropped, not clustered.
 */
export function mineWeaknesses(failures: readonly FailureObservation[]): FailurePattern[] {
  const grounded = failures.filter((f) => f.evidenceRef.trim().length > 0);
  const bySig = new Map<string, FailureObservation[]>();
  for (const f of grounded) {
    const sig = signatureOf(f.terminalCause);
    const list = bySig.get(sig) ?? [];
    bySig.set(sig, [...list, f]);
  }
  return [...bySig.entries()]
    .map(([signature, members], i) => ({
      id: `wp-${i + 1}`,
      signature,
      count: members.length,
      members,
      groundedBy: "verifier" as const,
    }))
    .sort((a, b) => b.count - a.count);
}
