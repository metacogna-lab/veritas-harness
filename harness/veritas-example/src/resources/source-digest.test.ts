import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { digestSources } from "./source-digest.ts";
import type { ResearchPlan } from "../ingest/schema.ts";
import type { LLMBackbone } from "@spine/llm/index.ts";

// ── fixtures ─────────────────────────────────────────────────────────────────

const TMP = join(import.meta.dir, "__digest_test_tmp__");

function makeHarness(): string {
  const root = join(TMP, "harness");
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(join(root, "docs", "strategy.md"), "# Strategy\n\nThe scope gate blocks off-scope requests.", "utf8");
  return root;
}

const BASE_PLAN: ResearchPlan = {
  version: "1",
  metadata: { slug: "digest-test", ingestedAt: "2026-01-01T00:00:00Z", ingestVersion: "0.1.0", model: "mock" },
  objective: "Verify scope-gate correctness via benchmark",
  loadout: "research",
  target: "src/safety",
  scope: { hosts: [], paths: ["src/safety"] },
  specialists: [{ role: "researcher", focus: "scope gate analysis" }],
  phases: [{ id: "p1", description: "run benchmark" }],
  sources: [{ kind: "doc", path: "docs/strategy.md" }],
  lessons: [],
  successCriteria: ["verify pass@1 ≥ 1"],
};

function mockLLM(reply: string): LLMBackbone {
  return {
    complete: async () => ({ text: reply, model: "mock", usage: { inputTokens: 0, outputTokens: 0 } }),
  } as unknown as LLMBackbone;
}

// ── setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true });
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true });
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe("digestSources", () => {
  it("writes per-source summary and synthesis", async () => {
    const root = makeHarness();
    const llm = mockLLM("Mock summary content.");

    const result = await digestSources({ plan: BASE_PLAN, harnessRoot: root, llm });

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]!.skipped).toBe(false);
    expect(existsSync(result.sources[0]!.summaryPath)).toBe(true);
    expect(existsSync(result.synthesisPath)).toBe(true);

    const summary = readFileSync(result.sources[0]!.summaryPath, "utf8");
    expect(summary).toContain("Source Summary");
    expect(summary).toContain("strategy.md");

    const synthesis = readFileSync(result.synthesisPath, "utf8");
    expect(synthesis).toContain("Source Synthesis");
  });

  it("skips existing summaries (idempotent)", async () => {
    const root = makeHarness();
    let calls = 0;
    const llm = mockLLM("Summary.");
    const trackingLLM = {
      complete: async (...args: Parameters<LLMBackbone["complete"]>) => {
        calls++;
        return llm.complete(...args);
      },
    } as unknown as LLMBackbone;

    // First run
    await digestSources({ plan: BASE_PLAN, harnessRoot: root, llm: trackingLLM });
    const firstCalls = calls;

    // Second run — should skip cached sources
    await digestSources({ plan: BASE_PLAN, harnessRoot: root, llm: trackingLLM });

    expect(calls).toBe(firstCalls); // no new LLM calls
    expect(result_skipped(root)).toBe(true);
  });

  it("regenerates when force=true", async () => {
    const root = makeHarness();
    let calls = 0;
    const trackingLLM = {
      complete: async () => { calls++; return { text: "Forced summary.", model: "mock", usage: { inputTokens: 0, outputTokens: 0 } }; },
    } as unknown as LLMBackbone;

    await digestSources({ plan: BASE_PLAN, harnessRoot: root, llm: trackingLLM });
    const firstCalls = calls;

    await digestSources({ plan: BASE_PLAN, harnessRoot: root, llm: trackingLLM, force: true });

    expect(calls).toBeGreaterThan(firstCalls); // new LLM calls made
  });

  it("writes stub when source file is missing", async () => {
    const root = makeHarness();
    const plan: ResearchPlan = {
      ...BASE_PLAN,
      sources: [{ kind: "doc", path: "docs/nonexistent.md" }],
    };

    const result = await digestSources({ plan, harnessRoot: root, llm: mockLLM("x") });

    const summary = readFileSync(result.sources[0]!.summaryPath, "utf8");
    expect(summary).toContain("source not found");
  });

  it("skips lesson-kind sources", async () => {
    const root = makeHarness();
    const plan: ResearchPlan = {
      ...BASE_PLAN,
      sources: [{ kind: "lesson", path: "resources/lessons.json" }],
    };

    const result = await digestSources({ plan, harnessRoot: root, llm: mockLLM("x") });

    expect(result.sources).toHaveLength(0); // lessons are not digested
  });

  it("emits onEvent lines", async () => {
    const root = makeHarness();
    const events: string[] = [];

    await digestSources({
      plan: BASE_PLAN,
      harnessRoot: root,
      llm: mockLLM("Summary."),
      onEvent: (l) => events.push(l),
    });

    expect(events.some((e) => e.includes("reading"))).toBe(true);
    expect(events.some((e) => e.includes("synthesising"))).toBe(true);
  });
});

// helper
function result_skipped(root: string): boolean {
  const summaryDir = join(root, "resources", "summary", "digest-test");
  return existsSync(join(summaryDir, "strategy.md"));
}
