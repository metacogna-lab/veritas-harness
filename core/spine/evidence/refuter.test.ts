import { describe, expect, test } from "bun:test";
import { refuteFinding, promoteFinding } from "./refuter.ts";
import { Mission } from "../mission/index.ts";
import { evidenceGate } from "./gate.ts";
import { LLMBackbone } from "../llm/index.ts";
import type { Transport, TransportResponse } from "../llm/types.ts";
import type { ProviderConfig } from "../config/index.ts";
import type { MissionScope } from "../safety/scope.ts";

const cfg: ProviderConfig = {
  provider: "anthropic",
  model: "refuter-model",
  apiKey: "sk-test-000000000000",
  baseUrl: "http://localhost",
  maxTokens: 100,
  temperature: 0.9, // a DIFFERENT temperature from the producing model
};
const zero = { inputTokens: 0, outputTokens: 0 };

/**
 * A deterministic, evidence-grounded stand-in for the skeptic model: it
 * confirms ONLY when the evidence text actually contains the claim, otherwise
 * it retracts. This exercises the real prompt/parse/promote pipeline.
 */
function skepticLLM(): LLMBackbone {
  const transport: Transport = async (_c, req): Promise<TransportResponse> => {
    const content = req.messages[0]!.content;
    const claim = content.split("CLAIM:\n")[1]!.split("\n\nEVIDENCE")[0]!.trim().toLowerCase();
    const evidence = content.split("EVIDENCE")[1]!.toLowerCase();
    const supported = evidence.includes(claim);
    const verdict = supported ? "confirmed" : "retracted";
    const reason = supported ? "evidence contains the claim" : "evidence does not support the claim";
    return { text: JSON.stringify({ verdict, reason }), usage: zero };
  };
  return new LLMBackbone({ configs: [cfg], transport, sleep: async () => {} });
}

/** An LLM that emits garbage, to exercise the fail-safe default. */
function garbageLLM(): LLMBackbone {
  const transport: Transport = async (): Promise<TransportResponse> => ({ text: "I dunno, maybe?", usage: zero });
  return new LLMBackbone({ configs: [cfg], transport, sleep: async () => {} });
}

const scope: MissionScope = { hosts: [], paths: ["/work"] };

function missionWith(claim: string, evidenceText: string) {
  let n = 0;
  const m = new Mission({ objective: "audit", scope, now: () => "t", idGen: () => `id-${n++}`, findingValidator: evidenceGate });
  const obs = m.record("observation", evidenceText, { tool: "read_file", ok: true });
  const added = m.addFinding({ claim, provenance: { toolCall: "read_file", observationSeq: obs.seq } });
  if (!added.accepted) throw new Error(`setup finding rejected: ${added.reason}`);
  return { mission: m, findingId: added.finding.id };
}

describe("refuteFinding", () => {
  test("retracts a known-false finding the evidence does not support", async () => {
    const { mission, findingId } = missionWith("the server enforces TLS 1.3", "the file says hello world");
    const finding = mission.findings.find((f) => f.id === findingId)!;
    const result = await refuteFinding(finding, mission.entries, skepticLLM());
    expect(result.verdict).toBe("retracted");
    expect(result.reason).toContain("does not support");
  });

  test("confirms a finding the evidence directly supports", async () => {
    const { mission, findingId } = missionWith("the file says hello world", "the file says hello world");
    const finding = mission.findings.find((f) => f.id === findingId)!;
    const result = await refuteFinding(finding, mission.entries, skepticLLM());
    expect(result.verdict).toBe("confirmed");
  });

  test("fail-safe: an unparseable verdict defaults to retracted", async () => {
    const { mission, findingId } = missionWith("anything", "anything");
    const finding = mission.findings.find((f) => f.id === findingId)!;
    const result = await refuteFinding(finding, mission.entries, garbageLLM());
    expect(result.verdict).toBe("retracted");
    expect(result.reason).toContain("unparseable");
  });
});

describe("promoteFinding records the outcome on the mission", () => {
  test("a retracted finding is marked retracted with the refuter's reason", async () => {
    const { mission, findingId } = missionWith("the server enforces TLS 1.3", "the file says hello world");
    const result = await promoteFinding(mission, findingId, skepticLLM());
    expect(result.verdict).toBe("retracted");
    const finding = mission.findings.find((f) => f.id === findingId)!;
    expect(finding.status).toBe("retracted");
    expect(finding.refutation).toContain("does not support");
  });

  test("a surviving finding is promoted to confirmed", async () => {
    const { mission, findingId } = missionWith("the file says hello world", "the file says hello world");
    const result = await promoteFinding(mission, findingId, skepticLLM());
    expect(result.verdict).toBe("confirmed");
    const finding = mission.findings.find((f) => f.id === findingId)!;
    expect(finding.status).toBe("confirmed");
  });

  test("throws for an unknown finding id", async () => {
    const { mission } = missionWith("x", "x");
    await expect(promoteFinding(mission, "does-not-exist", skepticLLM())).rejects.toThrow("not found");
  });
});
