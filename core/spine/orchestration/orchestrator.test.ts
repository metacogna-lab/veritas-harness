import { describe, expect, test } from "bun:test";
import {
  Orchestrator,
  buildWorkerPrompt,
  validateSubtasks,
  packContext,
  runPool,
  type Subtask,
} from "./orchestrator.ts";
import { LLMBackbone } from "../llm/index.ts";
import type { Transport, TransportResponse } from "../llm/types.ts";
import type { ProviderConfig } from "../config/index.ts";

const cfg: ProviderConfig = {
  provider: "anthropic",
  model: "fake",
  apiKey: "sk-test-000000000000",
  baseUrl: "http://localhost",
  maxTokens: 100,
  temperature: 0,
};
const zero = { inputTokens: 0, outputTokens: 0 };

/** An LLM whose behavior depends on the request content (system/prompt). */
function routedLLM(route: (system: string, user: string) => string): LLMBackbone {
  const transport: Transport = async (_c, req): Promise<TransportResponse> => ({
    text: route(req.system ?? "", req.messages[0]?.content ?? ""),
    usage: zero,
  });
  return new LLMBackbone({ configs: [cfg], transport, sleep: async () => {} });
}

describe("honest decomposition (invariant #7)", () => {
  test("buildWorkerPrompt always embeds the full parent objective", () => {
    const objective = "Audit the payment module for input-validation gaps";
    const prompt = buildWorkerPrompt(objective, { id: "st-0", description: "check the amount parser" }, "", 4000);
    expect(prompt).toContain(objective);
    expect(prompt).toContain("PARENT OBJECTIVE");
    expect(prompt).toContain("check the amount parser");
  });

  test("validateSubtasks rejects an empty (obscured) description", () => {
    expect(() => validateSubtasks([{ id: "st-0", description: "" }])).toThrow("DISHONEST DECOMPOSITION");
    expect(() => validateSubtasks([{ id: "st-1", description: "   " }])).toThrow("DISHONEST DECOMPOSITION");
  });

  test("decompose throws if the model returns an empty-description subtask", async () => {
    const llm = routedLLM(() => JSON.stringify([{ description: "real task" }, { description: "" }]));
    const orch = new Orchestrator({ llm });
    await expect(orch.decompose("obj")).rejects.toThrow("DISHONEST DECOMPOSITION");
  });

  test("EVERY worker prompt in a full run contains the truthful parent objective", async () => {
    const objective = "Summarize the three config files";
    const llm = routedLLM((system, user) => {
      if (system.includes("Decompose")) {
        return JSON.stringify([{ description: "read config A" }, { description: "read config B" }]);
      }
      if (system.includes("Synthesize")) {
        return JSON.stringify({ done: true, answer: "combined", knowledge: "" });
      }
      // worker call: assert the parent objective is present, echo it back
      expect(user).toContain(objective);
      return "worker output";
    });
    const orch = new Orchestrator({ llm });
    const result = await orch.run(objective);
    expect(result.workerResults).toHaveLength(2);
    for (const w of result.workerResults) {
      expect(w.prompt).toContain(objective);
      expect(w.prompt).toContain("PARENT OBJECTIVE");
    }
  });
});

describe("workload decomposition mechanics", () => {
  test("runPool respects the concurrency limit", async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);
    await runPool(items, 3, async (i) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return i;
    });
    expect(maxActive).toBeLessThanOrEqual(3);
    expect(maxActive).toBeGreaterThan(1);
  });

  test("runPool preserves order and runs every item", async () => {
    const out = await runPool([1, 2, 3, 4], 2, async (n) => n * 10);
    expect(out).toEqual([10, 20, 30, 40]);
  });

  test("packContext truncates to the budget", () => {
    const long = "x".repeat(5000);
    const packed = packContext(long, 100);
    expect(packed.length).toBeLessThan(long.length);
    expect(packed).toContain("packed to 100 chars");
  });

  test("multi-round synthesis accumulates knowledge across rounds", async () => {
    const objective = "iterative task";
    let round = 0;
    const seenKnowledge: string[] = [];
    const llm = routedLLM((system, user) => {
      if (system.includes("Decompose")) return JSON.stringify([{ description: "do the thing" }]);
      if (system.includes("Synthesize")) {
        round++;
        seenKnowledge.push(user.includes("round-1-notes") ? "had-prior" : "no-prior");
        if (round === 1) return JSON.stringify({ done: false, answer: "partial", knowledge: "round-1-notes" });
        return JSON.stringify({ done: true, answer: "final", knowledge: "round-2-notes" });
      }
      return "worker output";
    });
    const orch = new Orchestrator({ llm, maxRounds: 2 });
    const result = await orch.run(objective);
    expect(result.rounds).toBe(2);
    expect(result.answer).toBe("final");
    // round 2's synthesis saw round 1's accumulated knowledge
    expect(seenKnowledge).toEqual(["no-prior", "had-prior"]);
  });

  test("providedSubtasks bypass decomposition but are still validated", async () => {
    const llm = routedLLM((system) => (system.includes("Synthesize") ? JSON.stringify({ done: true, answer: "ok", knowledge: "" }) : "w"));
    const orch = new Orchestrator({ llm });
    const good: Subtask[] = [{ id: "a", description: "real" }];
    const r = await orch.run("obj", good);
    expect(r.answer).toBe("ok");
    await expect(orch.run("obj", [{ id: "b", description: "" }])).rejects.toThrow("DISHONEST DECOMPOSITION");
  });
});
