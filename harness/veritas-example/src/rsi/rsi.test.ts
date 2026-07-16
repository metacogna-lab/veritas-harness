import { test, expect, describe } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mineWeaknesses, signatureOf, gatherFailuresFromStore, writeFailureClusters } from "./weakness-mining.ts";
import { writeExperienceEntry, type HarnessConfigSnapshot } from "../mission/experience-store.ts";
import type { MissionSnapshot } from "@spine/mission/types.ts";
import { buildProposalContext, assertHonestContext, isProposalBounded, proposeEdit, type Proposer } from "./proposal.ts";
import { decideValidation, validateProposal } from "./validation.ts";
import { applyProposal } from "./apply.ts";
import { runRsi, summarizeRun } from "./run.ts";
import { HumanReleaseSession } from "@spine/safety/human-release.ts";
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

// ── helpers ────────────────────────────────────────────────────────────────────

const storeConfig: HarnessConfigSnapshot = {
  loadout: "research",
  specialistRoles: ["analyst"],
  toolNames: ["read_file"],
  scopeHosts: ["example.com"],
  scopePaths: ["src/"],
};

function makeStoreSnapshot(id: string, errorContent: string): MissionSnapshot {
  return {
    id,
    objective: "test mission",
    scope: { hosts: ["example.com"], paths: ["src/"] },
    status: "error",
    transcript: [
      { seq: 0, timestamp: "2026-01-01T00:00:00Z", kind: "objective", content: "test mission" },
      {
        seq: 1,
        timestamp: "2026-01-01T00:00:01Z",
        kind: "observation",
        content: errorContent,
        meta: { status: "error", tool: "http_get" },
      },
    ],
    findings: [],
  };
}

describe("experience store integration (T2)", () => {
  test("gatherFailuresFromStore loads failures across multiple missions", () => {
    const root = mkdtempSync(join(tmpdir(), "rsi-store-t2-"));
    try {
      writeExperienceEntry(root, makeStoreSnapshot("m-i1", 'SCOPE DENIED: host "a.io" not in scope'), storeConfig);
      writeExperienceEntry(root, makeStoreSnapshot("m-i2", 'SCOPE DENIED: host "b.io" not in scope'), storeConfig);
      writeExperienceEntry(root, makeStoreSnapshot("m-i3", "ERROR: tool threw parse error"), storeConfig);

      const failures = gatherFailuresFromStore(root, ["m-i1", "m-i2", "m-i3"]);
      expect(failures).toHaveLength(3);
      expect(failures.every((f) => f.evidenceRef === "1")).toBe(true);
      expect(failures[0]!.missionId).toBe("m-i1");
      expect(failures[2]!.terminalCause).toContain("ERROR:");
    } finally {
      rmSync(root, { recursive: true });
    }
  });

  test("writeFailureClusters writes failure-clusters.md to each mission dir", () => {
    const root = mkdtempSync(join(tmpdir(), "rsi-clusters-t2-"));
    try {
      writeExperienceEntry(root, makeStoreSnapshot("m-c1", 'SCOPE DENIED: host "x.io" not in scope'), storeConfig);
      writeExperienceEntry(root, makeStoreSnapshot("m-c2", 'SCOPE DENIED: host "y.io" not in scope'), storeConfig);

      const failures = gatherFailuresFromStore(root, ["m-c1", "m-c2"]);
      const patterns = mineWeaknesses(failures);
      writeFailureClusters(root, ["m-c1", "m-c2"], patterns);

      expect(existsSync(join(root, "m-c1", "failure-clusters.md"))).toBe(true);
      expect(existsSync(join(root, "m-c2", "failure-clusters.md"))).toBe(true);
      const content = readFileSync(join(root, "m-c1", "failure-clusters.md"), "utf8");
      expect(content).toContain("# Failure Clusters");
      expect(content).toContain("scope denied");
    } finally {
      rmSync(root, { recursive: true });
    }
  });

  test("runRsi with targetMissions: clusters produced, dry-run, no source files touched", async () => {
    const root = mkdtempSync(join(tmpdir(), "rsi-run-t2-"));
    try {
      writeExperienceEntry(root, makeStoreSnapshot("m-r1", 'SCOPE DENIED: host "a.io" not in scope'), storeConfig);
      writeExperienceEntry(root, makeStoreSnapshot("m-r2", 'SCOPE DENIED: host "b.io" not in scope'), storeConfig);
      writeExperienceEntry(root, makeStoreSnapshot("m-r3", "ERROR: tool threw: parse error"), storeConfig);

      const proposer: Proposer = async () => stubProposal("src/safety/scope.ts");
      const result = await runRsi({
        targetMissions: ["m-r1", "m-r2", "m-r3"],
        experienceStoreRoot: root,
        editableSurfaces: surfaces,
        behaviorsToPreserve: ["scope deny-by-default"],
        suite,
        proposer,
        runTests: async () => ({ pass: true, detail: "ok" }),
      });

      // Clusters produced from real store failures
      expect(result.patterns.length).toBeGreaterThan(0);
      // Dry-run (no policy wired)
      expect(result.dryRun).toBe(true);
      // All outcomes hold — no autonomous release
      expect(result.outcomes.every((o) => !o.released)).toBe(true);
      // Every outcome is a valid HumanReviewPacket
      for (const outcome of result.outcomes) {
        expect(outcome.packet.instructions).toContain("not apply it for you");
      }
      // failure-clusters.md written to every mission dir
      expect(existsSync(join(root, "m-r1", "failure-clusters.md"))).toBe(true);
      expect(existsSync(join(root, "m-r2", "failure-clusters.md"))).toBe(true);
      expect(existsSync(join(root, "m-r3", "failure-clusters.md"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true });
    }
  });

  test("runRsi with lastN: reads N most recent missions from the store", async () => {
    const root = mkdtempSync(join(tmpdir(), "rsi-lastn-t2-"));
    try {
      // Write 3 missions; lastN=2 should only load the 2 newest
      writeExperienceEntry(root, makeStoreSnapshot("m-old", 'SCOPE DENIED: host "old.io" not in scope'), storeConfig);
      writeExperienceEntry(root, makeStoreSnapshot("m-new1", 'SCOPE DENIED: host "new1.io" not in scope'), storeConfig);
      writeExperienceEntry(root, makeStoreSnapshot("m-new2", 'SCOPE DENIED: host "new2.io" not in scope'), storeConfig);

      const proposer: Proposer = async () => stubProposal("src/safety/scope.ts");
      const result = await runRsi({
        lastN: 2,
        experienceStoreRoot: root,
        editableSurfaces: surfaces,
        behaviorsToPreserve: [],
        suite,
        proposer,
        runTests: async () => ({ pass: true, detail: "ok" }),
      });

      // Should have loaded from 2 missions (at most 2 failure observations)
      const totalFailures = result.patterns.reduce((n, p) => n + p.count, 0);
      expect(totalFailures).toBeLessThanOrEqual(2);
      expect(result.dryRun).toBe(true);
    } finally {
      rmSync(root, { recursive: true });
    }
  });

  test("runRsi throws if experienceStoreRoot is missing when targetMissions is set", async () => {
    await expect(
      runRsi({
        targetMissions: ["m-1"],
        editableSurfaces: surfaces,
        behaviorsToPreserve: [],
        suite,
        proposer: async () => stubProposal("src/safety/scope.ts"),
        runTests: async () => ({ pass: true, detail: "ok" }),
      }),
    ).rejects.toThrow("experienceStoreRoot required");
  });
});

describe("weakness mining — edge cases", () => {
  test("empty failures array returns no patterns", () => {
    expect(mineWeaknesses([])).toHaveLength(0);
  });

  test("all-ungrounded failures (no evidenceRef) produce no patterns", () => {
    const ungrounded: FailureObservation[] = [
      { missionId: "m-a", terminalCause: "tool threw: timeout", causalState: "network", evidenceRef: "" },
      { missionId: "m-b", terminalCause: "tool threw: timeout", causalState: "network", evidenceRef: "  " },
    ];
    expect(mineWeaknesses(ungrounded)).toHaveLength(0);
  });

  test("four identical signatures collapse into one pattern with count 4", () => {
    const obs: FailureObservation[] = Array.from({ length: 4 }, (_, i) => ({
      missionId: `m-${i}`,
      terminalCause: 'SCOPE DENIED: host "x.io" not in scope',
      causalState: "fetch before scope was declared",
      evidenceRef: `obs:${i}`,
    }));
    const patterns = mineWeaknesses(obs);
    expect(patterns).toHaveLength(1);
    expect(patterns[0]!.count).toBe(4);
  });

  test("patterns are ranked by count descending (most frequent first)", () => {
    const obs: FailureObservation[] = [
      { missionId: "m-1", terminalCause: "refuter retracted finding", causalState: "", evidenceRef: "obs:1" },
      { missionId: "m-2", terminalCause: 'SCOPE DENIED: host "a.com" not in scope', causalState: "", evidenceRef: "obs:2" },
      { missionId: "m-3", terminalCause: 'SCOPE DENIED: host "b.net" not in scope', causalState: "", evidenceRef: "obs:3" },
      { missionId: "m-4", terminalCause: 'SCOPE DENIED: host "c.org" not in scope', causalState: "", evidenceRef: "obs:4" },
    ];
    const patterns = mineWeaknesses(obs);
    expect(patterns[0]!.count).toBeGreaterThanOrEqual(patterns[1]!.count);
  });

  test("runRsi with empty failures produces zero patterns and zero outcomes", async () => {
    const proposer: Proposer = async () => stubProposal("src/safety/scope.ts");
    const result = await runRsi({
      failures: [],
      editableSurfaces: surfaces,
      behaviorsToPreserve: [],
      suite,
      proposer,
      runTests: async () => ({ pass: true, detail: "ok" }),
    });
    expect(result.patterns).toHaveLength(0);
    expect(result.outcomes).toHaveLength(0);
    expect(result.dryRun).toBe(true);
  });

  test("maxPatterns limits how many patterns are attempted", async () => {
    const manyFailures: FailureObservation[] = [
      { missionId: "m-1", terminalCause: "SCOPE DENIED: host denied", causalState: "", evidenceRef: "obs:1" },
      { missionId: "m-2", terminalCause: "refuter retracted finding", causalState: "", evidenceRef: "obs:2" },
      { missionId: "m-3", terminalCause: "tool threw: parse error", causalState: "", evidenceRef: "obs:3" },
      { missionId: "m-4", terminalCause: "tool threw: not found", causalState: "", evidenceRef: "obs:4" },
    ];
    const called: string[] = [];
    const trackingProposer: Proposer = async (ctx) => {
      called.push(ctx.pattern.id);
      return stubProposal("src/safety/scope.ts");
    };
    await runRsi({
      failures: manyFailures,
      editableSurfaces: surfaces,
      behaviorsToPreserve: [],
      suite,
      proposer: trackingProposer,
      runTests: async () => ({ pass: true, detail: "ok" }),
      maxPatterns: 2,
    });
    expect(called.length).toBe(2);
  });
});
