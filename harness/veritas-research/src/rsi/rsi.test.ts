import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mineWeaknesses, signatureOf } from "./weakness-mining.ts";
import { buildProposalContext, assertHonestContext, isProposalBounded, proposeEdit, type Proposer } from "./proposal.ts";
import { decideValidation, validateProposal } from "./validation.ts";
import { applyProposal } from "./apply.ts";
import { runRsi, summarizeRun } from "./run.ts";
import { HumanReleaseSession } from "../safety/human-release.ts";
import type { FailureObservation, EditableSurface, HarnessEditProposal, RegressionSuite } from "./types.ts";

const failures = JSON.parse(
  readFileSync(join(import.meta.dir, "fixtures", "failures.json"), "utf8"),
) as FailureObservation[];
const suite = JSON.parse(readFileSync(join(import.meta.dir, "fixtures", "suite.json"), "utf8")) as RegressionSuite;

const surfaces: EditableSurface[] = [{ path: "src/safety/scope.ts", rationale: "scope decisions live here" }];

const stubProposal = (targetPath: string): HarnessEditProposal => ({
  id: "p-1",
  patternId: "wp-1",
  targetPath,
  description: "widen nothing; improve the denial message",
  diff: "--- a/src/safety/scope.ts\n+++ b/src/safety/scope.ts\n@@\n-old\n+new\n",
  rationale: "clearer guidance",
});

describe("weakness mining", () => {
  test("drops ungrounded failures and clusters by normalized signature", () => {
    const patterns = mineWeaknesses(failures);
    // Grounded failures: 2 host-scope denials cluster together; the fs-path denial
    // is a DIFFERENT mechanism (separate pattern); the refuter retraction is its own.
    // The ungrounded timeout (no evidenceRef) is dropped entirely → 3 patterns.
    expect(patterns).toHaveLength(3);
    const hostPattern = patterns.find((p) => p.signature.includes("host"));
    expect(hostPattern?.count).toBe(2); // ranked first (most frequent)
    expect(patterns[0]!.id).toBe("wp-1");
    expect(patterns.every((p) => p.groundedBy === "verifier")).toBe(true);
    // ungrounded failure never appears
    expect(patterns.flatMap((p) => p.members).some((m) => m.missionId === "m-5")).toBe(false);
  });

  test("signatureOf normalizes quotes and numbers", () => {
    expect(signatureOf('SCOPE DENIED: host "a.com" not in scope')).toBe(
      signatureOf('SCOPE DENIED: host "b.net" not in scope'),
    );
  });
});

describe("proposal (honest + bounded)", () => {
  test("buildProposalContext produces an honest description naming the real pattern", () => {
    const [pattern] = mineWeaknesses(failures);
    const ctx = buildProposalContext({ pattern: pattern!, editableSurfaces: surfaces, behaviorsToPreserve: ["scope deny-by-default"] });
    expect(() => assertHonestContext(ctx)).not.toThrow();
    expect(ctx.honestTaskDescription).toContain(pattern!.signature);
  });

  test("assertHonestContext rejects an empty-surface (dishonest) context", () => {
    const [pattern] = mineWeaknesses(failures);
    const ctx = buildProposalContext({ pattern: pattern!, editableSurfaces: [], behaviorsToPreserve: [] });
    expect(() => assertHonestContext(ctx)).toThrow(/no editable surfaces/);
  });

  test("out-of-bounds proposals are rejected", async () => {
    const [pattern] = mineWeaknesses(failures);
    const ctx = buildProposalContext({ pattern: pattern!, editableSurfaces: surfaces, behaviorsToPreserve: [] });
    const rogue: Proposer = async () => stubProposal("src/agent/index.ts");
    expect(isProposalBounded(await rogue(ctx), ctx)).toBe(false);
    await expect(proposeEdit(ctx, rogue)).rejects.toThrow(/out-of-bounds/);
  });
});

describe("validation (held-in + held-out)", () => {
  test("eligible only when BOTH held-in and held-out pass", () => {
    expect(decideValidation("p", { pass: true, detail: "" }, { pass: true, detail: "" }).eligible).toBe(true);
    expect(decideValidation("p", { pass: true, detail: "" }, { pass: false, detail: "regressed" }).eligible).toBe(false);
    expect(decideValidation("p", { pass: false, detail: "not fixed" }, { pass: true, detail: "" }).eligible).toBe(false);
  });

  test("validateProposal runs both sets via the injected runner", async () => {
    const seen: string[][] = [];
    const result = await validateProposal("p", suite, async (ids) => {
      seen.push(ids);
      return { pass: true, detail: "ok" };
    });
    expect(result.eligible).toBe(true);
    expect(seen).toEqual([suite.heldIn, suite.heldOut]);
  });
});

describe("apply (human gate — invariant #5)", () => {
  test("an eligible proposal is DENIED when no releaser is wired (fail-safe), packet still emitted", async () => {
    const [pattern] = mineWeaknesses(failures);
    const validation = decideValidation("p-1", { pass: true, detail: "" }, { pass: true, detail: "" });
    const outcome = await applyProposal({ proposal: stubProposal("src/safety/scope.ts"), validation, pattern: pattern! });
    expect(outcome.released).toBe(false);
    expect(outcome.decision.allowed).toBe(false);
    expect(outcome.packet.instructions).toContain("not apply it for you");
    expect(outcome.packet.proposal.id).toBe("p-1");
  });

  test("an ineligible proposal is never offered for release", async () => {
    const [pattern] = mineWeaknesses(failures);
    const validation = decideValidation("p-1", { pass: false, detail: "not fixed" }, { pass: true, detail: "" });
    const outcome = await applyProposal({
      proposal: stubProposal("src/safety/scope.ts"),
      validation,
      pattern: pattern!,
      policy: { releaser: async () => true }, // even a permissive releaser must not fire
    });
    expect(outcome.released).toBe(false);
    expect(outcome.decision.allowed).toBe(false);
    if (!outcome.decision.allowed) {
      expect(outcome.decision.reason).toContain("not eligible");
    }
  });

  test("a human releaser can release an eligible proposal (still a human step to apply)", async () => {
    const [pattern] = mineWeaknesses(failures);
    const validation = decideValidation("p-1", { pass: true, detail: "" }, { pass: true, detail: "" });
    const outcome = await applyProposal({
      proposal: stubProposal("src/safety/scope.ts"),
      validation,
      pattern: pattern!,
      policy: { releaser: async () => true },
      session: new HumanReleaseSession(),
    });
    expect(outcome.released).toBe(true);
  });
});

describe("run (dry-run orchestration)", () => {
  test("full pass is a dry-run with no releases when no policy is wired", async () => {
    const proposer: Proposer = async () => stubProposal("src/safety/scope.ts");
    const result = await runRsi({
      failures,
      editableSurfaces: surfaces,
      behaviorsToPreserve: ["scope deny-by-default"],
      suite,
      proposer,
      runTests: async () => ({ pass: true, detail: "ok" }),
    });
    expect(result.dryRun).toBe(true);
    expect(result.outcomes.every((o) => o.released === false)).toBe(true);
    expect(summarizeRun(result)).toContain("dry-run");
  });
});
