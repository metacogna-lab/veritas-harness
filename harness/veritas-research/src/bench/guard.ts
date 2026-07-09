/**
 * Anti-fitting guard — plan 03 §3.2 / plan 05 standing rule.
 *
 * Grading (and the solver that produces answers) must be TASK-AGNOSTIC: it may
 * not reference the specific test items it will be graded on. The classic
 * failure is a solver/grader keyed to task ids or oracle answer literals — that
 * fits the model to the test set and inflates the number.
 *
 * `antiFittingGuard` scans grading/solver source text and fails the build if it
 * references any committed task id or any oracle answer literal. It is a pure
 * function so a deliberately-bad case can be asserted in a unit test.
 */

export interface AntiFittingInput {
  /** Source text of the grader/solver code under scrutiny. */
  sources: string[];
  /** Committed task ids for the suite. */
  taskIds: string[];
  /** Committed oracle answer values for the suite. */
  oracleAnswers: string[];
}

export class AntiFittingViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AntiFittingViolation";
  }
}

/**
 * Throw AntiFittingViolation if any grading/solver source references a specific
 * task id or oracle answer literal. Returns silently when clean.
 */
export function antiFittingGuard(input: AntiFittingInput): void {
  const blob = input.sources.join("\n");
  for (const id of input.taskIds) {
    if (id.length >= 2 && blob.includes(`"${id}"`)) {
      throw new AntiFittingViolation(`grading/solver source references task id "${id}" — it must be task-agnostic`);
    }
    if (id.length >= 2 && blob.includes(`'${id}'`)) {
      throw new AntiFittingViolation(`grading/solver source references task id '${id}' — it must be task-agnostic`);
    }
  }
  // Oracle answer literals are only suspicious when they are distinctive (long
  // or unusual). Short generic tokens like "allow"/"deny" are legitimate domain
  // vocabulary a correct solver must use, so only flag answers >= 8 chars.
  for (const ans of input.oracleAnswers) {
    if (ans.length >= 8 && blob.includes(ans)) {
      throw new AntiFittingViolation(`grading/solver source embeds oracle answer literal "${ans}" — it must not fit the test set`);
    }
  }
}
