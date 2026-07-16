import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LLMBackbone } from "@spine/llm/index.ts";
import type { ProviderConfig } from "@spine/config/index.ts";
import type { TransportResponse } from "@spine/llm/types.ts";
import { parseIntentFile } from "./parse-intent.ts";
import { buildResourcesCatalog } from "./resources-catalog.ts";
import { fitIntent } from "./fit-intent.ts";
import { runIngest } from "./ingest.ts";

const cfg: ProviderConfig = {
  provider: "anthropic",
  model: "fake-ingest",
  apiKey: "sk-test-000000000000",
  baseUrl: "http://localhost",
  maxTokens: 4096,
  temperature: 0,
};

const GOLDEN_PLAN = {
  version: "1",
  metadata: {
    slug: "scope-gate-study",
    ingestedAt: "2026-07-09T12:00:00.000Z",
    ingestVersion: "0.1.0",
    model: "fake/fake-ingest",
  },
  objective: "Measure scope-gate pass@1 for black-box mode",
  loadout: "research",
  target: "bench/scope-gate",
  scope: { hosts: [], paths: ["bench/scope-gate", "src/safety/scope.ts"] },
  specialists: [
    { role: "researcher", focus: "scope gate behavior" },
    { role: "analyst", focus: "synthesis and findings" },
  ],
  phases: [{ id: "p1", description: "Run scope-gate bench black-box mode and capture results" }],
  sources: [
    { kind: "lesson", path: "resources/lessons.json" },
    { kind: "doc", path: "agents/docs/processed/strategy.md" },
  ],
  lessons: [],
  successCriteria: [
    "Reproducible pass@1 via verify-claims",
    "At least one confirmed finding with provenance",
  ],
  benchmark: { suite: "scope-gate", mode: "black" },
};

function mockLLM(): LLMBackbone {
  const resp: TransportResponse = { text: JSON.stringify(GOLDEN_PLAN), usage: { inputTokens: 1, outputTokens: 1 } };
  return new LLMBackbone({
    configs: [cfg],
    transport: async () => resp,
    sleep: async () => {},
  });
}

describe("ingest integration (mock LLM)", () => {
  test("fitIntent produces valid plan from example NEW.md", async () => {
    const example = join(import.meta.dir, "../../ingest/examples/scope-gate-study.NEW.md");
    const harnessRoot = join(import.meta.dir, "../..");
    const intent = parseIntentFile(readFileSync(example, "utf8"));
    const catalog = buildResourcesCatalog({
      harnessRoot,
      objective: intent.frontmatter.title,
      extraSources: intent.frontmatter.sources,
    });
    const plan = await fitIntent({
      intent,
      catalog,
      llm: mockLLM(),
      modelLabel: "fake/fake-ingest",
      now: () => "2026-07-09T12:00:00.000Z",
    });
    expect(plan.metadata.slug).toBe("scope-gate-study");
    expect(plan.loadout).toBe("research");
    expect(plan.phases.length).toBeGreaterThan(0);
  });

  test("runIngest dry-run does not write files", async () => {
    const example = join(import.meta.dir, "../../ingest/examples/scope-gate-study.NEW.md");
    const { plan, outputPath } = await runIngest({
      inputPath: example,
      llm: mockLLM(),
      dryRun: true,
    });
    expect(plan.objective).toContain("scope-gate");
    expect(outputPath).toContain("missions/scope-gate-study/research-plan.json");
  });
});
