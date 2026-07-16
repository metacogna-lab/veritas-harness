import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  requireHumanRelease,
  HumanReleaseSession,
  type HumanReleasePolicy,
  type TerminalAction,
} from "@spine/safety/human-release.ts";
import { createSafetyCheck } from "@spine/safety/index.ts";
import { ToolRegistry } from "@spine/tools/registry.ts";
import { Agent } from "../agent/index.ts";
import { Mission } from "@spine/mission/index.ts";
import { LLMBackbone } from "@spine/llm/index.ts";
import type { Transport, TransportResponse } from "@spine/llm/types.ts";
import type { ProviderConfig } from "@spine/config/index.ts";

const action = (overrides: Partial<TerminalAction> = {}): TerminalAction => ({
  toolName: "publish_report",
  kind: "publish",
  summary: "Publish findings to external channel",
  ...overrides,
});

describe("requireHumanRelease (invariant #5)", () => {
  test("fail-safe deny when no releaser wired", async () => {
    const d = await requireHumanRelease(action(), {}, new HumanReleaseSession());
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toContain("HUMAN RELEASE REQUIRED");
  });

  test("interactive release grants session release-once", async () => {
    const session = new HumanReleaseSession();
    const policy: HumanReleasePolicy = { releaser: () => true };
    expect((await requireHumanRelease(action(), policy, session)).allowed).toBe(true);
    expect((await requireHumanRelease(action(), {}, session)).allowed).toBe(true);
  });

  test("interactive denial blocks execution", async () => {
    const policy: HumanReleasePolicy = { releaser: () => false };
    const d = await requireHumanRelease(action(), policy, new HumanReleaseSession());
    expect(d.allowed).toBe(false);
  });

  test("pre-released allowlist permits headless release", async () => {
    const policy: HumanReleasePolicy = { preReleased: ["publish_report:publish"] };
    const d = await requireHumanRelease(action(), policy, new HumanReleaseSession());
    expect(d.allowed).toBe(true);
  });
});

describe("terminal tool e2e — unattended never auto-executes", () => {
  const cfg: ProviderConfig = {
    provider: "anthropic",
    model: "fake",
    apiKey: "sk-test-000000000000",
    baseUrl: "http://localhost",
    maxTokens: 100,
    temperature: 0,
  };
  const zero = { inputTokens: 0, outputTokens: 0 };

  test("unattended run denies terminal tool and never calls run()", async () => {
    let executed = false;
    const registry = new ToolRegistry().register({
      name: "publish_report",
      description: "Publish a report externally",
      inputSchema: z.object({ body: z.string() }),
      riskTier: "safe",
      requiresHumanRelease: true,
      terminalActionKind: "publish",
      run: async () => {
        executed = true;
        return "published";
      },
    });

    const transport: Transport = async (): Promise<TransportResponse> => ({
      text: "",
      nativeToolCalls: [{ name: "publish_report", input: { body: "secret findings" } }],
      usage: zero,
    });
    const llm = new LLMBackbone({ configs: [cfg], transport, sleep: async () => {} });
    const mission = new Mission({ objective: "publish", scope: { hosts: [], paths: [] } });
    const safetyCheck = createSafetyCheck({ scope: mission.scope });

    const agent = new Agent({
      llm,
      registry,
      systemPrompt: "test",
      mission,
      maxSteps: 3,
      safetyCheck,
    });

    await agent.run();
    expect(executed).toBe(false);
    const obs = mission.snapshot().transcript.filter((e) => e.kind === "observation");
    expect(obs.some((e) => String(e.content).includes("HUMAN RELEASE REQUIRED"))).toBe(true);
  });

  test("released terminal tool executes run() once", async () => {
    let executed = false;
    const registry = new ToolRegistry().register({
      name: "publish_report",
      description: "Publish a report externally",
      inputSchema: z.object({ body: z.string() }),
      riskTier: "safe",
      requiresHumanRelease: true,
      terminalActionKind: "publish",
      run: async () => {
        executed = true;
        return "published";
      },
    });

    const transport: Transport = async (): Promise<TransportResponse> => ({
      text: "",
      nativeToolCalls: [{ name: "publish_report", input: { body: "ok" } }],
      usage: zero,
    });
    const llm = new LLMBackbone({ configs: [cfg], transport, sleep: async () => {} });
    const mission = new Mission({ objective: "publish", scope: { hosts: [], paths: [] } });
    const safetyCheck = createSafetyCheck({
      scope: mission.scope,
      humanRelease: { releaser: () => true },
    });

    const agent = new Agent({ llm, registry, systemPrompt: "test", mission, maxSteps: 3, safetyCheck });
    await agent.run();
    expect(executed).toBe(true);
  });
});
