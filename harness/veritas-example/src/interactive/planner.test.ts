/**
 * Planner turn coverage — mock LLM, dogma preview, write-gate helpers.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, readFileSync, existsSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LLMBackbone } from "../llm/index.ts";
import type { ResearchPlan } from "../ingest/schema.ts";
import { evalPlanWithConfig } from "../resources/plan-eval.ts";
import { missionOutputPath } from "../ingest/ingest.ts";
import { createSession } from "./session.ts";
import { planTurn } from "./planner.ts";
import { createStdinApprover } from "./approver.ts";

const WEAK_PLAN = {
  version: "1" as const,
  metadata: {
    slug: "weak",
    ingestedAt: "2026-07-15T00:00:00.000Z",
    ingestVersion: "0.1.0",
    model: "fake",
  },
  objective: "explore the system briefly",
  loadout: "research",
  target: ".",
  scope: { hosts: [] as string[], paths: ["src"] },
  specialists: [{ role: "researcher", focus: "look around" }],
  phases: [{ id: "p1", description: "Look around" }],
  sources: [] as { kind: "doc"; path: string }[],
  lessons: [] as string[],
  successCriteria: ["feel good about it"],
};

const STRONG_PLAN: ResearchPlan = {
  version: "1",
  metadata: {
    slug: "auth-audit",
    ingestedAt: "2026-07-15T00:00:00.000Z",
    ingestVersion: "0.1.0",
    model: "fake",
  },
  objective:
    "Measure whether the auth scope gate denies off-scope writes at pass@1 under at least 3 fixtures",
  loadout: "research",
  target: "src/safety",
  scope: { hosts: [], paths: ["src/safety", "bench"] },
  specialists: [
    { role: "researcher", focus: "enumerate scope-gate fixtures" },
    { role: "analyst", focus: "confirm measurable outcomes" },
  ],
  phases: [
    { id: "map", description: "Map scope-gate entry points and fixtures" },
    { id: "measure", description: "Run fixtures and record pass@1 rates" },
  ],
  sources: [{ kind: "doc", path: "docs/CLI.md" }],
  lessons: [],
  successCriteria: ["verify at least 3 fixtures show deny-on-off-scope"],
};

function mockLLM(responses: string[]): LLMBackbone {
  let i = 0;
  return {
    complete: async () => {
      const text = responses[Math.min(i, responses.length - 1)]!;
      i++;
      return { text, toolCalls: [], usage: { inputTokens: 1, outputTokens: 1 } };
    },
  } as unknown as LLMBackbone;
}

describe("planTurn", () => {
  test("invalid then valid JSON → draft + dogma preview", async () => {
    const session = createSession();
    const llm = mockLLM(["not json", JSON.stringify(STRONG_PLAN)]);
    const result = await planTurn(session, "Audit the auth scope gate", {
      llm,
      maxRetries: 2,
      modelLabel: "test/mock",
    });
    expect(result.ok).toBe(true);
    expect(session.draft?.metadata.slug).toBe("auth-audit");
    expect(result.eval?.pass).toBe(true);
    expect(result.message).toContain("Dogma PASS");
  });

  test("weak plan surfaces dogma FAIL", async () => {
    const session = createSession();
    const llm = mockLLM([JSON.stringify(WEAK_PLAN)]);
    const result = await planTurn(session, "explore", { llm, maxRetries: 0 });
    expect(result.ok).toBe(true);
    expect(result.eval?.pass).toBe(false);
    expect(result.message).toContain("Dogma FAIL");
  });

  test("exhausts retries on persistent invalid output", async () => {
    const session = createSession();
    const llm = mockLLM(["{}", "{bad"]);
    const result = await planTurn(session, "x", { llm, maxRetries: 1 });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Could not produce");
  });
});

describe("/write dogma gate (session-level)", () => {
  test("strong plan passes eval; weak plan does not", () => {
    expect(evalPlanWithConfig(STRONG_PLAN).pass).toBe(true);
    expect(evalPlanWithConfig(WEAK_PLAN as ResearchPlan).pass).toBe(false);
  });

  test("write path only exists after dogma pass (simulate /write)", () => {
    const root = mkdtempSync(join(tmpdir(), "veritas-write-"));
    try {
      const strong = STRONG_PLAN;
      expect(evalPlanWithConfig(strong).pass).toBe(true);
      const out = missionOutputPath(root, strong.metadata.slug);
      mkdirSync(join(out, ".."), { recursive: true });
      writeFileSync(out, JSON.stringify(strong, null, 2));
      expect(existsSync(out)).toBe(true);
      expect(JSON.parse(readFileSync(out, "utf8")).objective).toContain("scope gate");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("createStdinApprover", () => {
  test("y/yes allow; empty denies", async () => {
    const allow = createStdinApprover(async () => "y");
    expect(await allow({ toolName: "shell", tier: "dangerous" })).toBe(true);
    const deny = createStdinApprover(async () => "");
    expect(await deny({ toolName: "shell", tier: "dangerous" })).toBe(false);
  });
});
