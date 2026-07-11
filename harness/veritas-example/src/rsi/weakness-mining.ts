/**
 * Stage 1 — weakness mining. Cluster mission failures into failure patterns
 * GROUNDED BY THE VERIFIER: only failures that carry provenance (an evidenceRef
 * pointing at a real observation) are admitted, because an ungrounded "failure" is
 * itself a confabulation (invariant #3). Different causal states can share a
 * surface error, so members retain their causal state for the proposer to inspect.
 */
import type { FailureObservation, FailurePattern } from "./types.ts";
import { readFailedCalls, listExperienceMissions } from "../mission/experience-store.ts";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

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

/**
 * Load grounded failures from the experience store for the given mission IDs.
 * Converts TranscriptEntry failures to FailureObservation[]; the transcript seq
 * serves as the evidenceRef (provenance, invariant #3).
 */
export function gatherFailuresFromStore(
  storeRoot: string,
  missionIds: string[],
): FailureObservation[] {
  return missionIds.flatMap((missionId) =>
    readFailedCalls(storeRoot, missionId).map((entry) => ({
      missionId,
      terminalCause: entry.content,
      causalState: (entry.meta?.tool as string) ?? "",
      evidenceRef: String(entry.seq),
    })),
  );
}

/**
 * Load the N most recent missions from the store and gather their failures.
 * Convenience wrapper around gatherFailuresFromStore.
 */
export function gatherFailuresFromLastN(storeRoot: string, n: number): FailureObservation[] {
  const missions = listExperienceMissions(storeRoot).slice(0, n);
  return gatherFailuresFromStore(storeRoot, missions.map((m) => m.missionId));
}

/**
 * Write a failure-clusters.md summary into each mission's experience directory
 * so the outer RSI loop can reference it without re-running mining.
 */
export function writeFailureClusters(
  storeRoot: string,
  missionIds: string[],
  patterns: FailurePattern[],
): void {
  const lines = [
    "# Failure Clusters",
    `Generated: ${new Date().toISOString()}`,
    `Missions: ${missionIds.join(", ")}`,
    `Patterns: ${patterns.length}`,
    "",
  ];
  for (const p of patterns) {
    lines.push(`## ${p.id} — \`${p.signature}\` (count: ${p.count})`);
    for (const m of p.members) {
      lines.push(`- mission ${m.missionId} seq:${m.evidenceRef} — ${m.causalState || "(no causal state)"}`);
    }
    lines.push("");
  }
  const content = lines.join("\n");
  for (const missionId of missionIds) {
    const dir = join(storeRoot, missionId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "failure-clusters.md"), content, "utf8");
  }
}
