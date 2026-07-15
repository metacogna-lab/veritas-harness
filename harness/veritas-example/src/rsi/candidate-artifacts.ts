/**
 * Write harness-evolver loadout-candidate artifacts for human review (P5).
 * Never applies the edit — only records proposal + eval for review packets.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CandidateEvalResult, HarnessEditProposal, HumanReviewPacket } from "./types.ts";

export interface CandidateArtifactPaths {
  dir: string;
  proposedLoadout: string;
  reasoning: string;
  candidateEval: string;
}

/** Persist a human-review packet under loadout-candidate/<proposalId>/. */
export function writeLoadoutCandidateArtifacts(
  harnessRoot: string,
  packet: HumanReviewPacket,
  evalResult?: CandidateEvalResult,
): CandidateArtifactPaths {
  const dir = join(harnessRoot, "loadout-candidate", packet.proposal.id);
  mkdirSync(dir, { recursive: true });
  const proposedLoadout = join(dir, "proposed-loadout.ts");
  const reasoning = join(dir, "reasoning.md");
  const candidateEval = join(dir, "candidate-eval.json");

  writeFileSync(
    proposedLoadout,
    [
      `// RSI candidate — NOT applied. Human must review and merge.`,
      `// target: ${packet.proposal.targetPath}`,
      `/*`,
      packet.proposal.diff,
      `*/`,
      ``,
    ].join("\n"),
    "utf8",
  );

  writeFileSync(
    reasoning,
    [
      `# RSI candidate ${packet.proposal.id}`,
      ``,
      `## Pattern`,
      `- signature: ${packet.pattern.signature}`,
      `- count: ${packet.pattern.count}`,
      ``,
      `## Proposal`,
      `- target: \`${packet.proposal.targetPath}\``,
      `- ${packet.proposal.description}`,
      ``,
      `## Rationale`,
      packet.proposal.rationale,
      ``,
      `## Validation`,
      `- eligible: ${packet.validation.eligible}`,
      `- ${packet.validation.detail}`,
      ``,
      `## Instructions`,
      packet.instructions,
      ``,
    ].join("\n"),
    "utf8",
  );

  const evalPayload = evalResult ?? packet.candidateEvalResult ?? null;
  writeFileSync(candidateEval, JSON.stringify(evalPayload, null, 2) + "\n", "utf8");

  return { dir, proposedLoadout, reasoning, candidateEval };
}

/** Convenience: write artifacts for every held review packet in an RSI run. */
export function writeArtifactsForProposals(
  harnessRoot: string,
  proposals: HarnessEditProposal[],
  packets: HumanReviewPacket[],
): CandidateArtifactPaths[] {
  void proposals;
  return packets.map((p) => writeLoadoutCandidateArtifacts(harnessRoot, p));
}
