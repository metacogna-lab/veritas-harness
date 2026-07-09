import { describe, expect, test } from "bun:test";
import {
  requestApproval,
  ApprovalSession,
  GATED_TIERS,
  SPICY_TIERS,
  type ApprovalPolicy,
  type ApprovalRequest,
} from "./approval.ts";
import { createSafetyCheck } from "./index.ts";
import type { Tool } from "../tools/registry.ts";
import type { MissionScope } from "./scope.ts";
import { z } from "zod";

const req = (tier: ApprovalRequest["tier"], toolName = "t"): ApprovalRequest => ({ toolName, tier });

describe("risk-tier sets", () => {
  test("gated tiers are intrusive/credential/dangerous", () => {
    expect([...GATED_TIERS].sort()).toEqual(["credential", "dangerous", "intrusive"]);
  });
  test("spicy tiers are credential/dangerous", () => {
    expect([...SPICY_TIERS].sort()).toEqual(["credential", "dangerous"]);
  });
});

describe("ungated tiers", () => {
  test("safe/active never require approval", async () => {
    const session = new ApprovalSession();
    expect((await requestApproval(req("safe"), {}, session)).allowed).toBe(true);
    expect((await requestApproval(req("active"), {}, session)).allowed).toBe(true);
  });
});

describe("fail-safe deny (invariant #2)", () => {
  test("gated tool, no approver, no pre-auth ⇒ DENIED", async () => {
    const d = await requestApproval(req("dangerous"), {}, new ApprovalSession());
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toContain("no approver wired");
  });

  test("every gated tier fails safe when nothing is wired", async () => {
    for (const tier of ["intrusive", "credential", "dangerous"] as const) {
      const d = await requestApproval(req(tier), {}, new ApprovalSession());
      expect(d.allowed).toBe(false);
    }
  });
});

describe("interactive path", () => {
  test("approve on first use", async () => {
    const policy: ApprovalPolicy = { approver: () => true };
    const d = await requestApproval(req("intrusive"), policy, new ApprovalSession());
    expect(d.allowed).toBe(true);
  });

  test("deny when the human declines", async () => {
    const policy: ApprovalPolicy = { approver: () => false };
    const d = await requestApproval(req("intrusive"), policy, new ApprovalSession());
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toContain("declined");
  });

  test("approve-once-then-free: approver asked only on first call", async () => {
    let asks = 0;
    const policy: ApprovalPolicy = {
      approver: () => {
        asks++;
        return true;
      },
    };
    const session = new ApprovalSession();
    await requestApproval(req("intrusive"), policy, session);
    await requestApproval(req("intrusive"), policy, session);
    await requestApproval(req("intrusive"), policy, session);
    expect(asks).toBe(1);
  });
});

describe("pre-authorized path", () => {
  test("on-list tool is allowed", async () => {
    const policy: ApprovalPolicy = { preAuthorized: ["scan"] };
    const d = await requestApproval(req("intrusive", "scan"), policy, new ApprovalSession());
    expect(d.allowed).toBe(true);
  });

  test("off-list tool with no interactive fallback is DENIED", async () => {
    const policy: ApprovalPolicy = { preAuthorized: ["scan"] };
    const d = await requestApproval(req("intrusive", "exfil"), policy, new ApprovalSession());
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toContain("not on the pre-authorized allowlist");
  });
});

describe("SPICY warnings", () => {
  test("credential/dangerous warn on EVERY call, even after approval", async () => {
    const warnings: string[] = [];
    const policy: ApprovalPolicy = { approver: () => true, warn: (m) => warnings.push(m) };
    const session = new ApprovalSession();
    await requestApproval(req("dangerous"), policy, session);
    await requestApproval(req("dangerous"), policy, session); // already approved, still warns
    expect(warnings).toHaveLength(2);
  });

  test("intrusive (gated but not spicy) does not warn", async () => {
    const warnings: string[] = [];
    const policy: ApprovalPolicy = { approver: () => true, warn: (m) => warnings.push(m) };
    await requestApproval(req("intrusive"), policy, new ApprovalSession());
    expect(warnings).toHaveLength(0);
  });
});

describe("audit sink", () => {
  test("records allow and deny decisions for gated calls", async () => {
    const entries: string[] = [];
    const policy: ApprovalPolicy = {
      preAuthorized: ["ok"],
      audit: (e) => entries.push(`${e.decision}:${e.toolName}`),
    };
    await requestApproval(req("intrusive", "ok"), policy, new ApprovalSession());
    await requestApproval(req("intrusive", "bad"), policy, new ApprovalSession());
    expect(entries).toEqual(["allow:ok", "deny:bad"]);
  });
});

describe("composed check: scope first, then approval", () => {
  const tool = (tier: Tool["riskTier"]): Tool => ({
    name: "probe",
    description: "d",
    inputSchema: z.object({ url: z.string() }),
    riskTier: tier,
    scopeTargets: (i) => [{ kind: "network", value: (i as { url: string }).url }],
    run: async () => "ok",
  });
  const scope: MissionScope = { hosts: ["example.com"], paths: [] };

  test("off-scope call is denied by scope BEFORE approval is consulted", async () => {
    let approverAsked = false;
    const check = createSafetyCheck({
      scope,
      policy: { approver: () => ((approverAsked = true), true) },
    });
    const d = await check({ toolName: "probe", targets: [{ kind: "network", value: "https://evil.test" }] }, tool("dangerous"));
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toStartWith("SCOPE DENIED:");
    expect(approverAsked).toBe(false); // scope short-circuits before asking
  });

  test("in-scope gated call with nothing wired fails safe (unattended deny)", async () => {
    const check = createSafetyCheck({ scope });
    const d = await check({ toolName: "probe", targets: [{ kind: "network", value: "https://example.com" }] }, tool("dangerous"));
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toStartWith("APPROVAL DENIED:");
  });

  test("in-scope active call passes both gates with nothing wired", async () => {
    const check = createSafetyCheck({ scope });
    const d = await check({ toolName: "probe", targets: [{ kind: "network", value: "https://example.com" }] }, tool("active"));
    expect(d.allowed).toBe(true);
  });
});
