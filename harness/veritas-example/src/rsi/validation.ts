/**
 * Stage 3 — proposal validation. A candidate edit is eligible ONLY if it passes
 * BOTH: held-in tests (proving the mined weakness is actually fixed) and held-out
 * tests (proving no regressions were introduced). Held-in and held-out are separate
 * committed sets — never blended — mirroring the benchmark harness's black/white
 * separation.
 *
 * The actual test execution is injected (`RunTests`) so this module is pure and
 * never itself applies or runs an untrusted edit; the run.ts orchestrator wires a
 * concrete runner in a sandbox when a human opts to evaluate a candidate.
 */
import type { RegressionSuite, ValidationResult } from "./types.ts";

export interface TestRunOutcome {
  pass: boolean;
  detail: string;
}
export type RunTests = (testIds: string[]) => Promise<TestRunOutcome>;

/** Pure decision: eligible iff held-in passes AND held-out passes. */
export function decideValidation(
  proposalId: string,
  heldIn: TestRunOutcome,
  heldOut: TestRunOutcome,
): ValidationResult {
  const eligible = heldIn.pass && heldOut.pass;
  const detail = eligible
    ? "held-in fixed and held-out clean"
    : `held-in ${heldIn.pass ? "pass" : "FAIL"} (${heldIn.detail}); held-out ${heldOut.pass ? "pass" : "FAIL"} (${heldOut.detail})`;
  return { proposalId, heldInPass: heldIn.pass, heldOutPass: heldOut.pass, eligible, detail };
}

/** Run both sets via the injected runner and decide. Held-out always runs (regression guard). */
export async function validateProposal(
  proposalId: string,
  suite: RegressionSuite,
  run: RunTests,
): Promise<ValidationResult> {
  const heldIn = await run(suite.heldIn);
  const heldOut = await run(suite.heldOut);
  return decideValidation(proposalId, heldIn, heldOut);
}
