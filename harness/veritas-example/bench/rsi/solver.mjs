/**
 * RSI bench solver — runs weakness-mining on a list of FailureObservation[]
 * and returns "<patternCount>,<topPatternCount>" as a string.
 *
 * The oracle contains the expected string for each task. The anti-fitting guard
 * validates that this solver does not hardcode task IDs or oracle answers.
 */
import { mineWeaknesses } from "../../src/rsi/weakness-mining.ts";

/** @param {import("../../src/rsi/types.ts").FailureObservation[]} failures */
export async function solve(failures) {
  const patterns = mineWeaknesses(failures);
  const topCount = patterns[0]?.count ?? 0;
  return `${patterns.length},${topCount}`;
}
