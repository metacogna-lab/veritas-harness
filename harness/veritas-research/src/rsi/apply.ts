/**
 * Stage 4 — apply, HUMAN-GATED (invariant #5: human before consequence).
 *
 * This module NEVER writes to disk and NEVER runs git. Self-modifying harness code
 * is the most consequential terminal action there is, so the loop stops one step
 * short: it emits a HumanReviewPacket (the diff + validation + grounding) and routes
 * the decision through `requireHumanRelease`. Even when a human releases, the actual
 * application is a human step performed outside this module. An ineligible proposal
 * is never even offered for release.
 */
import { requireHumanRelease, type HumanReleasePolicy, HumanReleaseSession } from "../safety/human-release.ts";
import type { ScopeDecision } from "../safety/scope.ts";
import type { HarnessEditProposal, ValidationResult, FailurePattern, HumanReviewPacket, CandidateEvalResult } from "./types.ts";

export interface ApplyOutcome {
  /** True only if a human explicitly released the edit for a human to apply. */
  released: boolean;
  decision: ScopeDecision;
  packet: HumanReviewPacket;
}

function buildPacket(
  proposal: HarnessEditProposal,
  validation: ValidationResult,
  pattern: FailurePattern,
  candidateEvalResult?: CandidateEvalResult,
): HumanReviewPacket {
  const candidateNote =
    candidateEvalResult
      ? ` Candidate bench eval: ${candidateEvalResult.decision.toUpperCase()} (${candidateEvalResult.rationale}).`
      : "";
  return {
    proposal,
    validation,
    pattern,
    candidateEvalResult,
    instructions:
      `Review the diff for ${proposal.targetPath}. It targets failure pattern ` +
      `"${pattern.signature}" and passed held-in + held-out validation.${candidateNote} If you approve, ` +
      `apply the diff on a branch yourself and re-run the full suite — the harness will ` +
      `not apply it for you.`,
  };
}

/**
 * Gate a validated proposal. Ineligible candidates are refused outright. Eligible
 * candidates are offered through the human-release gate; with no releaser wired
 * (the default, unattended case) this FAIL-SAFE denies — the packet is still emitted
 * for later human review.
 */
export async function applyProposal(args: {
  proposal: HarnessEditProposal;
  validation: ValidationResult;
  pattern: FailurePattern;
  policy?: HumanReleasePolicy;
  session?: HumanReleaseSession;
  /** Optional candidate bench evaluation result to surface to the human reviewer. */
  candidateEvalResult?: CandidateEvalResult;
}): Promise<ApplyOutcome> {
  const packet = buildPacket(args.proposal, args.validation, args.pattern, args.candidateEvalResult);

  // If candidate eval explicitly rejects, flag the packet but still surface it to the human.
  if (args.candidateEvalResult?.decision === "reject" && args.validation.eligible) {
    return {
      released: false,
      decision: {
        allowed: false,
        reason: `RSI: candidate bench eval REJECTED — ${args.candidateEvalResult.rationale}`,
      },
      packet,
    };
  }

  if (!args.validation.eligible) {
    return {
      released: false,
      decision: { allowed: false, reason: `RSI: proposal ${args.proposal.id} is not eligible (${args.validation.detail})` },
      packet,
    };
  }

  const policy = args.policy ?? {};
  const session = args.session ?? new HumanReleaseSession();
  const decision = await requireHumanRelease(
    {
      toolName: "rsi-apply",
      kind: "deploy",
      summary: `Apply harness edit ${args.proposal.id} to ${args.proposal.targetPath}`,
      draft: { diff: args.proposal.diff, rationale: args.proposal.rationale },
    },
    policy,
    session,
  );

  return { released: decision.allowed, decision, packet };
}
