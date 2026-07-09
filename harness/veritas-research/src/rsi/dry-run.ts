/**
 * `veritas rsi` dry-run — demonstrate the self-improving loop end to end WITHOUT a
 * real proposer model or a sandbox test runner, and WITHOUT applying anything. It
 * mines the committed failure fixtures, assembles honest bounded contexts, emits
 * placeholder proposals, and shows the human-gated apply stage refusing to release
 * (fail-safe). Wiring a real proposer + sandbox runner is a deliberate, separate,
 * human-authorized step (see agents/plans/08-eight-plane-and-rsi.md).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runRsi, summarizeRun } from "./run.ts";
import type { Proposer } from "./proposal.ts";
import type { FailureObservation, RegressionSuite, EditableSurface } from "./types.ts";

const FIXTURES = join(import.meta.dir, "fixtures");

/** Deterministic placeholder — emits a review stub, never a real self-edit. */
const placeholderProposer: Proposer = async (ctx) => ({
  id: `dry-${ctx.pattern.id}`,
  patternId: ctx.pattern.id,
  targetPath: ctx.editableSurfaces[0]!.path,
  description: `(dry-run) would address "${ctx.pattern.signature}"`,
  diff: "(dry-run: no diff generated — a real proposer model produces this)",
  rationale: "dry-run scaffold; a human authors the real edit",
});

export async function rsiDryRun(): Promise<string> {
  const failures = JSON.parse(readFileSync(join(FIXTURES, "failures.json"), "utf8")) as FailureObservation[];
  const suite = JSON.parse(readFileSync(join(FIXTURES, "suite.json"), "utf8")) as RegressionSuite;
  const editableSurfaces: EditableSurface[] = [{ path: "src/safety/scope.ts", rationale: "scope decisions live here" }];

  const result = await runRsi({
    failures,
    editableSurfaces,
    behaviorsToPreserve: ["scope deny-by-default", "provenance before claim"],
    suite,
    proposer: placeholderProposer,
    // Dry-run: tests are not executed, so nothing is eligible and nothing can be released.
    runTests: async () => ({ pass: false, detail: "dry-run: tests not executed" }),
    // No HumanReleasePolicy ⇒ fail-safe deny at the apply gate (invariant #5).
  });

  return (
    `${summarizeRun(result)}\n\n` +
    "(dry-run: no proposer model or sandbox runner is wired; nothing was eligible, " +
    "nothing was applied. The apply stage is human-gated by design — see " +
    "agents/plans/08-eight-plane-and-rsi.md.)"
  );
}
