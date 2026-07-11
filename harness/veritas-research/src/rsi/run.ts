/**
 * RSI orchestrator — chains the four stages into one honest, human-gated pass:
 *   mine weaknesses → propose bounded edits → validate held-in/held-out → apply-gate.
 *
 * DRY-RUN BY DEFAULT: with no HumanReleasePolicy wired, the apply stage fail-safe
 * denies and emits review packets instead of releasing anything. Nothing is ever
 * written to disk here. The proposer model and test runner are injected.
 */
import type { FailureObservation, EditableSurface, RegressionSuite, FailurePattern } from "./types.ts";
import { mineWeaknesses, gatherFailuresFromStore, writeFailureClusters } from "./weakness-mining.ts";
import { listExperienceMissions } from "../mission/experience-store.ts";
import { buildProposalContext, proposeEdit, type Proposer } from "./proposal.ts";
import { validateProposal, type RunTests } from "./validation.ts";
import { applyProposal, type ApplyOutcome } from "./apply.ts";
import type { HumanReleasePolicy, HumanReleaseSession } from "../safety/human-release.ts";

export interface RsiRunInput {
  /**
   * Direct failure list — for tests and callers that already have failures in hand.
   * Required if neither targetMissions nor lastN is provided.
   */
  failures?: FailureObservation[];
  /**
   * Read failures from these specific mission IDs in the experience store.
   * Mutually exclusive with `lastN`.
   */
  targetMissions?: string[];
  /**
   * Read failures from the N most recent missions in the experience store.
   * Mutually exclusive with `targetMissions`.
   */
  lastN?: number;
  /**
   * Root path to the experience store (resources/experience/).
   * Required when using `targetMissions` or `lastN`.
   */
  experienceStoreRoot?: string;
  editableSurfaces: EditableSurface[];
  behaviorsToPreserve: string[];
  suite: RegressionSuite;
  proposer: Proposer;
  runTests: RunTests;
  /** Absent ⇒ dry-run (fail-safe deny; packets emitted for human review). */
  policy?: HumanReleasePolicy;
  session?: HumanReleaseSession;
  /** How many top patterns to attempt this pass. Default 3. */
  maxPatterns?: number;
}

export interface RsiRunResult {
  patterns: FailurePattern[];
  outcomes: ApplyOutcome[];
  dryRun: boolean;
}

export async function runRsi(input: RsiRunInput): Promise<RsiRunResult> {
  // Resolve failures from the experience store if targetMissions or lastN is set.
  let resolvedFailures: FailureObservation[];
  let resolvedMissionIds: string[] | undefined;
  if (input.targetMissions !== undefined) {
    if (!input.experienceStoreRoot) throw new Error("runRsi: experienceStoreRoot required when targetMissions is set");
    resolvedMissionIds = input.targetMissions;
    resolvedFailures = gatherFailuresFromStore(input.experienceStoreRoot, input.targetMissions);
  } else if (input.lastN !== undefined) {
    if (!input.experienceStoreRoot) throw new Error("runRsi: experienceStoreRoot required when lastN is set");
    const recent = listExperienceMissions(input.experienceStoreRoot).slice(0, input.lastN);
    resolvedMissionIds = recent.map((m) => m.missionId);
    resolvedFailures = gatherFailuresFromStore(input.experienceStoreRoot, resolvedMissionIds);
  } else {
    resolvedFailures = input.failures ?? [];
  }

  const patterns = mineWeaknesses(resolvedFailures);
  const top = patterns.slice(0, input.maxPatterns ?? 3);
  const outcomes: ApplyOutcome[] = [];

  for (const pattern of top) {
    const ctx = buildProposalContext({
      pattern,
      editableSurfaces: input.editableSurfaces,
      behaviorsToPreserve: input.behaviorsToPreserve,
    });
    let proposal;
    try {
      proposal = await proposeEdit(ctx, input.proposer);
    } catch {
      // A dishonest/out-of-bounds/failed proposal is skipped, never forced through.
      continue;
    }
    const validation = await validateProposal(proposal.id, input.suite, input.runTests);
    const outcome = await applyProposal({
      proposal,
      validation,
      pattern,
      policy: input.policy,
      session: input.session,
    });
    outcomes.push(outcome);
  }

  // Write failure-clusters.md into each mission's experience dir (even on dry-run).
  if (input.experienceStoreRoot && resolvedMissionIds && resolvedMissionIds.length > 0) {
    writeFailureClusters(input.experienceStoreRoot, resolvedMissionIds, patterns);
  }

  return { patterns, outcomes, dryRun: input.policy === undefined };
}

/** One-line human-readable summary of a run (for CLI output). */
export function summarizeRun(result: RsiRunResult): string {
  const released = result.outcomes.filter((o) => o.released).length;
  const lines = [
    `RSI ${result.dryRun ? "dry-run" : "run"}: ${result.patterns.length} weakness pattern(s), ` +
      `${result.outcomes.length} proposal(s), ${released} released.`,
  ];
  for (const o of result.outcomes) {
    const v = o.packet.validation;
    lines.push(
      `- ${o.packet.proposal.id} → ${o.packet.proposal.targetPath}: ` +
        `${v.eligible ? "eligible" : "ineligible"}, ${o.released ? "RELEASED" : "held (human review)"}`,
    );
  }
  return lines.join("\n");
}
