import { describe, expect, test } from "bun:test";
import { validateResearchPlan } from "./validate.ts";

const VALID_PLAN = {
  version: "1",
  metadata: {
    slug: "scope-gate-study",
    ingestedAt: "2026-07-09T00:00:00.000Z",
    ingestVersion: "0.1.0",
    model: "fake/fake",
  },
  objective: "Measure scope-gate pass@1",
  loadout: "research",
  target: "bench/scope-gate",
  scope: { hosts: [], paths: ["bench/scope-gate", "src/safety"] },
  specialists: [
    { role: "researcher", focus: "explore scope gate" },
    { role: "analyst", focus: "synthesize findings" },
  ],
  phases: [{ id: "p1", description: "Run scope-gate bench black-box mode" }],
  sources: [{ kind: "doc", path: "agents/docs/processed/strategy.md" }],
  lessons: [],
  successCriteria: ["verify-claims green"],
  benchmark: { suite: "scope-gate", mode: "black" },
};

describe("validate", () => {
  test("accepts valid plan JSON", () => {
    const r = validateResearchPlan(JSON.stringify(VALID_PLAN));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan.objective).toContain("scope-gate");
  });

  test("parses JSON wrapped in prose", () => {
    const wrapped = `Here is the plan:\n${JSON.stringify(VALID_PLAN)}\nDone.`;
    const r = validateResearchPlan(wrapped);
    expect(r.ok).toBe(true);
  });

  test("rejects missing objective", () => {
    const bad = { ...VALID_PLAN, objective: "" };
    const r = validateResearchPlan(JSON.stringify(bad));
    expect(r.ok).toBe(false);
  });

  test("rejects empty phases", () => {
    const bad = { ...VALID_PLAN, phases: [] };
    const r = validateResearchPlan(JSON.stringify(bad));
    expect(r.ok).toBe(false);
  });
});
