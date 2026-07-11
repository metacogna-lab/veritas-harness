/**
 * Types for the self-improving harness (RSI) loop. See agents/plans/08-eight-plane-and-rsi.md.
 *
 * The whole loop is HUMAN-GATED: it mines weaknesses, proposes bounded harness
 * edits, validates them on held-in/held-out data, and STOPS at human release. It
 * never applies an edit autonomously (invariant #5) and never hides a subtask's
 * shape from a worker model (invariant #7).
 */

/** A single grounded failure drawn from a mission's execution trace. */
export interface FailureObservation {
  missionId: string;
  /** Surface error signature, e.g. "SCOPE DENIED", "refuter retracted", "tool threw". */
  terminalCause: string;
  /** Underlying mechanism/context — different causes can share a surface error. */
  causalState: string;
  /** Provenance: the observation/tool this failure is grounded in. Empty ⇒ ungrounded. */
  evidenceRef: string;
}

/** A cluster of failures sharing a terminal-cause signature, grounded by the verifier. */
export interface FailurePattern {
  id: string;
  signature: string;
  count: number;
  members: FailureObservation[];
  groundedBy: "verifier";
}

/** A file the proposer is permitted to edit, with why it is in scope. */
export interface EditableSurface {
  path: string;
  rationale: string;
}

/** A bounded, HONEST context handed to the proposer model (invariant #7). */
export interface ProposalContext {
  pattern: FailurePattern;
  editableSurfaces: EditableSurface[];
  behaviorsToPreserve: string[];
  pastAttempts: HarnessEditProposal[];
  /** A truthful description of the subtask. Must not obscure the objective's shape. */
  honestTaskDescription: string;
}

/** A bounded edit the proposer suggests. It is a candidate only — never applied here. */
export interface HarnessEditProposal {
  id: string;
  patternId: string;
  targetPath: string;
  description: string;
  /** Proposed unified diff, produced by the proposer model. */
  diff: string;
  rationale: string;
}

/** Which committed tests prove the fix (held-in) and guard against regression (held-out). */
export interface RegressionSuite {
  heldIn: string[];
  heldOut: string[];
}

export interface ValidationResult {
  proposalId: string;
  heldInPass: boolean;
  heldOutPass: boolean;
  /** Eligible to be offered for human release iff BOTH pass. */
  eligible: boolean;
  detail: string;
}

/** Outcome of running the bench suite against a candidate harness edit. */
export interface CandidateEvalResult {
  /** The suite that was evaluated. */
  suite: string;
  /** Overall promotion decision from the candidate run. */
  decision: "promote" | "hold" | "reject";
  /** Scores from the candidate run (parallel to bench results.json summary). */
  candidateScores: { black_box: number; white_box: number };
  /** Scores from the committed baseline results.json. */
  baselineScores: { black_box: number; white_box: number };
  /** Human-readable rationale for the decision. */
  rationale: string;
}

/** What a human reviews before deciding to apply an edit. Emitted; never auto-applied. */
export interface HumanReviewPacket {
  proposal: HarnessEditProposal;
  validation: ValidationResult;
  pattern: FailurePattern;
  instructions: string;
  /** Present when a candidate bench eval was run before surfacing this packet. */
  candidateEvalResult?: CandidateEvalResult;
}
