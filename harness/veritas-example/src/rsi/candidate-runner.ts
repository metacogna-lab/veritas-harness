/**
 * Candidate bench runner for RSI validation (P4) — shells out to
 * verify-harness-candidate when a candidate config path is provided.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import type { RunTests } from "./validation.ts";

/** Build a RunTests fn that invokes verify-harness-candidate (or stub if no path). */
export function createCandidateRunTests(opts: {
  harnessRoot: string;
  /** Path to candidate config JSON (HARNESS_CANDIDATE_CONFIG equivalent). */
  candidatePath?: string;
  suite?: string;
}): RunTests {
  const { harnessRoot, candidatePath, suite } = opts;
  if (!candidatePath) {
    return async () => ({ pass: false, detail: "candidate verify skipped — no --candidate path" });
  }

  return async () => {
    const script = join(harnessRoot, "scripts", "verify-harness-candidate.mjs");
    const args = [script, "--candidate", candidatePath];
    if (suite) args.push("--suite", suite);
    const res = spawnSync("bun", args, { cwd: harnessRoot, encoding: "utf8" });
    const ok = res.status === 0;
    const detail = [
      ok ? "verify-harness-candidate: promote/hold" : "verify-harness-candidate: reject",
      (res.stdout ?? "").trim().slice(0, 400),
      (res.stderr ?? "").trim().slice(0, 400),
    ]
      .filter(Boolean)
      .join("\n");
    return { pass: ok, detail };
  };
}
