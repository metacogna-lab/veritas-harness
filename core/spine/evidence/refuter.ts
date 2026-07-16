/**
 * Adversarial verification (the refuter) — invariant #4: refute before confirm.
 *
 * Before a finding is promoted to `confirmed`, a SEPARATE model instance (a
 * different model or a different temperature from the one that produced the
 * finding) is asked to DISPROVE it using ONLY the committed evidence in the
 * mission log. If it cannot disprove it, the finding is confirmed; if it can,
 * the finding is retracted and the refuter's reason is logged alongside it.
 *
 * Fail-safe posture: if the refuter's verdict cannot be parsed, we default to
 * `retracted`. "Refute before confirm" means ambiguity never yields confirmed.
 */
import type { LLMBackbone } from "../llm/index.ts";
import type { Mission } from "../mission/index.ts";
import type { Finding, TranscriptEntry } from "../mission/types.ts";
import { parseLastObject } from "../parse/json.ts";

export type Verdict = "confirmed" | "retracted";

export interface RefutationResult {
  verdict: Verdict;
  reason: string;
}

const REFUTER_SYSTEM =
  "You are a skeptical, adversarial verifier. Your job is to DISPROVE a claim using ONLY " +
  "the evidence provided below. You may not use outside knowledge or assumptions. If the " +
  "evidence does not fully and unambiguously support the claim, you MUST retract it. " +
  'Reply with a single JSON object: {"verdict":"confirmed"|"retracted","reason":"<why>"}. ' +
  'Use "confirmed" ONLY when the evidence directly supports the claim; otherwise "retracted".';

/** Collect the committed evidence backing a finding (its observation entry). */
function collectEvidence(finding: Finding, transcript: readonly TranscriptEntry[]): string {
  const entry = transcript.find((e) => e.seq === finding.provenance.observationSeq);
  if (!entry) return "(no backing evidence found in the mission log)";
  return `[seq ${entry.seq}] observation from tool "${finding.provenance.toolCall}":\n${entry.content}`;
}

/**
 * Run the refuter against a single finding. `refuter` should be a distinct LLM
 * instance (different model/temperature) from the one that produced the finding.
 */
export async function refuteFinding(
  finding: Finding,
  transcript: readonly TranscriptEntry[],
  refuter: LLMBackbone,
  signal?: AbortSignal,
): Promise<RefutationResult> {
  const evidence = collectEvidence(finding, transcript);
  const completion = await refuter.complete(
    {
      system: REFUTER_SYSTEM,
      messages: [
        {
          role: "user",
          content: `CLAIM:\n${finding.claim}\n\nEVIDENCE (the only thing you may rely on):\n${evidence}`,
        },
      ],
      temperature: 0,
    },
    signal,
  );

  const obj = parseLastObject(completion.text);
  const rawVerdict = obj?.verdict;
  const reason = typeof obj?.reason === "string" ? obj.reason : "no reason provided";

  if (rawVerdict === "confirmed") return { verdict: "confirmed", reason };
  if (rawVerdict === "retracted") return { verdict: "retracted", reason };
  // Fail-safe: an unparseable verdict is treated as a failure to confirm.
  return { verdict: "retracted", reason: `unparseable refuter verdict; defaulting to retracted (${completion.text.slice(0, 120)})` };
}

/**
 * Run the refuter and record the outcome on the mission: promote to `confirmed`
 * or mark `retracted`, logging the refuter's reason. Returns the result.
 */
export async function promoteFinding(
  mission: Mission,
  findingId: string,
  refuter: LLMBackbone,
  signal?: AbortSignal,
): Promise<RefutationResult> {
  const finding = mission.findings.find((f) => f.id === findingId);
  if (!finding) throw new Error(`finding "${findingId}" not found on mission`);
  const result = await refuteFinding(finding, mission.entries, refuter, signal);
  mission.updateFindingStatus(findingId, result.verdict, result.reason);
  return result;
}
