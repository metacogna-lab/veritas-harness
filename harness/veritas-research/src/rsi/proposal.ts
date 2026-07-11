/**
 * Stage 2 — harness proposal. Assemble a BOUNDED, HONEST context for a proposer
 * model and (via an injected proposer) obtain a candidate edit. Two guarantees:
 *   - Bounded: the proposer may only touch declared editable surfaces.
 *   - Honest: the task description must not obscure the objective's shape
 *     (invariant #7). `assertHonestContext` enforces this before any model call.
 *
 * The proposer model itself is injected (`Proposer`) so this module is pure and
 * testable; the loop never hardcodes a provider here.
 */
import type { ProposalContext, HarnessEditProposal, FailurePattern, EditableSurface } from "./types.ts";

export type Proposer = (ctx: ProposalContext) => Promise<HarnessEditProposal>;

export function buildProposalContext(input: {
  pattern: FailurePattern;
  editableSurfaces: EditableSurface[];
  behaviorsToPreserve: string[];
  pastAttempts?: HarnessEditProposal[];
  /** Read-only advisory from the lessons delta store; wired in by the RSI orchestrator. */
  priorLessonContext?: string;
}): ProposalContext {
  const { pattern, editableSurfaces } = input;
  const honestTaskDescription =
    `Fix the failure pattern "${pattern.signature}" (${pattern.count} grounded occurrence(s)). ` +
    `You may edit only: ${editableSurfaces.map((s) => s.path).join(", ") || "(none)"}. ` +
    `Preserve these behaviors: ${input.behaviorsToPreserve.join("; ") || "(none stated)"}. ` +
    `This is a genuine harness-repair task; it is described in full and nothing is hidden from you.`;
  return {
    pattern,
    editableSurfaces,
    behaviorsToPreserve: input.behaviorsToPreserve,
    pastAttempts: input.pastAttempts ?? [],
    honestTaskDescription,
    priorLessonContext: input.priorLessonContext,
  };
}

/**
 * Enforce the honest-decomposition invariant before a proposer runs: the context
 * must name its editable surfaces and describe the real task. Throws otherwise.
 */
export function assertHonestContext(ctx: ProposalContext): void {
  if (ctx.editableSurfaces.length === 0) {
    throw new Error("dishonest/empty context: no editable surfaces declared");
  }
  if (!ctx.honestTaskDescription.includes(ctx.pattern.signature)) {
    throw new Error("dishonest context: task description does not name the real failure pattern");
  }
}

/** Confirm a returned proposal only touches a declared editable surface (bounded). */
export function isProposalBounded(proposal: HarnessEditProposal, ctx: ProposalContext): boolean {
  return ctx.editableSurfaces.some((s) => s.path === proposal.targetPath);
}

/** Assemble context, assert honesty, run the injected proposer, and reject out-of-bounds edits. */
export async function proposeEdit(ctx: ProposalContext, proposer: Proposer): Promise<HarnessEditProposal> {
  assertHonestContext(ctx);
  const proposal = await proposer(ctx);
  if (!isProposalBounded(proposal, ctx)) {
    throw new Error(`out-of-bounds proposal: "${proposal.targetPath}" is not a declared editable surface`);
  }
  return proposal;
}
