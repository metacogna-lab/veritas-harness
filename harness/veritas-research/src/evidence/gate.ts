/**
 * Evidence / provenance gate — invariant #3: provenance before claim.
 *
 * A finding is only accepted if its provenance points at a REAL tool
 * observation already in the mission's append-only transcript:
 *   - the referenced seq exists,
 *   - it is an `observation` entry (not a model turn, note, etc.),
 *   - it was produced by the tool the finding names,
 *   - and it was a SUCCESSFUL observation — a scope denial or tool error
 *     (`ok:false`) is not evidence and cannot back a finding.
 *
 * This is a `FindingValidator`, so `Mission.addFinding()` routes through it via
 * the seam wired in BASIC — a rejected finding never enters the findings array.
 */
import type { FindingValidator, FindingDecision } from "../mission/index.ts";
import type { Finding, TranscriptEntry } from "../mission/types.ts";

const reject = (reason: string): FindingDecision => ({ accepted: false, reason });

export const evidenceGate: FindingValidator = (
  finding: Finding,
  transcript: readonly TranscriptEntry[],
): FindingDecision => {
  const { observationSeq, toolCall } = finding.provenance;
  const entry = transcript.find((e) => e.seq === observationSeq);

  if (!entry) return reject(`no transcript entry at seq ${observationSeq}`);
  if (entry.kind !== "observation") {
    return reject(`seq ${observationSeq} is a "${entry.kind}" entry, not an observation`);
  }
  if (entry.meta?.tool !== toolCall) {
    return reject(`seq ${observationSeq} was produced by "${String(entry.meta?.tool)}", not "${toolCall}"`);
  }
  if (entry.meta?.ok === false) {
    return reject(`seq ${observationSeq} was a failed/denied tool call, not real evidence`);
  }
  return { accepted: true };
};
