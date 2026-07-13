/**
 * H-5: base-scripts is an RSI editable surface, and edits to it stay human-gated.
 * "Improve base-scripts at runtime" must never become "auto-apply per mission" —
 * this test pins the cadence: a proposal targeting base-scripts, with no
 * HumanReleasePolicy wired, is held (fail-safe deny), never released (invariant #5).
 */
import { describe, expect, it } from "bun:test";
import {
  DEFAULT_EDITABLE_SURFACES,
  BASE_SCRIPT_EDITABLE_SURFACES,
  isBaseScriptSurface,
} from "./editable-surfaces.ts";
import { runRsi } from "./run.ts";
import type { Proposer } from "./proposal.ts";
import type { FailureObservation, RegressionSuite } from "./types.ts";

describe("editable surfaces (H-5)", () => {
  it("base-scripts are registered editable surfaces", () => {
    const paths = DEFAULT_EDITABLE_SURFACES.map((s) => s.path);
    expect(paths).toContain("../../base-scripts/doctor.mjs");
    expect(paths).toContain("../../base-scripts/lib/stats.mjs");
    expect(BASE_SCRIPT_EDITABLE_SURFACES.every((s) => isBaseScriptSurface(s.path))).toBe(true);
    expect(isBaseScriptSurface("src/safety/scope.ts")).toBe(false);
  });

  it("a proposal targeting base-scripts is held, never released, with no policy (invariant #5)", async () => {
    const failures: FailureObservation[] = [
      { missionId: "m1", terminalCause: "doctor check failed", causalState: "doctor", evidenceRef: "1" },
    ];
    const suite: RegressionSuite = { heldIn: ["a"], heldOut: ["b"] };
    const proposer: Proposer = async (ctx) => ({
      id: `p-${ctx.pattern.id}`,
      patternId: ctx.pattern.id,
      targetPath: ctx.editableSurfaces[0]!.path,
      description: "would tweak the shared doctor script",
      diff: "(candidate)",
      rationale: "shared-script improvement",
    });

    const result = await runRsi({
      failures,
      editableSurfaces: BASE_SCRIPT_EDITABLE_SURFACES,
      behaviorsToPreserve: ["deny-by-default"],
      suite,
      proposer,
      // Even if tests "passed", no HumanReleasePolicy ⇒ apply gate fail-safe denies.
      runTests: async () => ({ pass: true, detail: "held-in+held-out pass" }),
    });

    expect(result.dryRun).toBe(true);
    expect(result.outcomes.length).toBeGreaterThan(0);
    expect(result.outcomes.every((o) => !o.released)).toBe(true);
    expect(result.outcomes[0]!.packet.proposal.targetPath).toContain("base-scripts/");
  });
});
