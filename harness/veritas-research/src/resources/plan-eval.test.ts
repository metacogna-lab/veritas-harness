import { describe, it, expect } from "bun:test";
import { evalPlan, renderEvalReport } from "./plan-eval.ts";
import type { ResearchPlan } from "../ingest/schema.ts";

const BASE_PLAN: ResearchPlan = {
  version: "1",
  metadata: { slug: "test-plan", ingestedAt: "2026-01-01T00:00:00Z", ingestVersion: "0.1.0", model: "fixture/mock" },
  objective: "Measure scope-gate pass@1 for black-box mode with at least 10 trials",
  loadout: "research",
  target: "bench/scope-gate",
  scope: { hosts: [], paths: ["bench/scope-gate", "src/safety"] },
  specialists: [
    { role: "researcher", focus: "scope gate behaviour and pass rates" },
    { role: "analyst", focus: "synthesis of findings into confirmed claims" },
  ],
  phases: [
    { id: "p1", description: "Run scope-gate benchmark in black-box mode and capture results" },
    { id: "p2", description: "Analyse outcomes and record confirmed findings" },
  ],
  sources: [{ kind: "doc", path: "agents/docs/processed/strategy.md" }],
  lessons: [],
  successCriteria: ["Reproducible pass@1 ≥ 0.9 verified via verify-claims"],
};

describe("evalPlan", () => {
  it("passes a well-formed plan", () => {
    const result = evalPlan(BASE_PLAN);
    expect(result.pass).toBe(true);
    expect(result.score).toBeGreaterThan(0.7);
  });

  it("fails when objective is too vague", () => {
    const plan: ResearchPlan = {
      ...BASE_PLAN,
      objective: "explore stuff",
    };
    const result = evalPlan(plan);
    const dim = result.dimensions.find((d) => d.id === "falsifiable-question")!;
    expect(dim.pass).toBe(false);
    expect(result.pass).toBe(false); // required dimension
  });

  it("fails when scope is empty", () => {
    const plan: ResearchPlan = {
      ...BASE_PLAN,
      scope: { hosts: [], paths: [] },
    };
    const result = evalPlan(plan);
    const dim = result.dimensions.find((d) => d.id === "bounded-scope")!;
    expect(dim.pass).toBe(false);
    expect(result.pass).toBe(false);
  });

  it("fails when only one phase is defined", () => {
    const plan: ResearchPlan = {
      ...BASE_PLAN,
      phases: [{ id: "p1", description: "Do everything in one step" }],
    };
    const result = evalPlan(plan);
    const dim = result.dimensions.find((d) => d.id === "phased-approach")!;
    expect(dim.pass).toBe(false);
    expect(result.pass).toBe(false);
  });

  it("fails when success criteria have no measurable language", () => {
    const plan: ResearchPlan = {
      ...BASE_PLAN,
      successCriteria: ["The scope gate works well"],
    };
    const result = evalPlan(plan);
    const dim = result.dimensions.find((d) => d.id === "measurable-success")!;
    expect(dim.pass).toBe(false);
    expect(result.pass).toBe(false);
  });

  it("warns (advisory) when no sources are provided, but does not block", () => {
    const plan: ResearchPlan = { ...BASE_PLAN, sources: [] };
    const result = evalPlan(plan);
    const dim = result.dimensions.find((d) => d.id === "source-grounded")!;
    expect(dim.required).toBe(false);
    expect(dim.pass).toBe(false);
    // plan still passes overall since source-grounded is advisory
    expect(result.pass).toBe(true);
  });

  it("blocks on deceptive phase descriptions (invariant 7)", () => {
    const plan: ResearchPlan = {
      ...BASE_PLAN,
      phases: [
        { id: "p1", description: "Run benchmark" },
        { id: "p2", description: "Bypass safety by hiding the real objective from the worker" },
      ],
    };
    const result = evalPlan(plan);
    const dim = result.dimensions.find((d) => d.id === "honest-decomposition")!;
    expect(dim.pass).toBe(false);
    expect(result.pass).toBe(false);
  });

  it("score is a fraction between 0 and 1", () => {
    const result = evalPlan(BASE_PLAN);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});

describe("renderEvalReport", () => {
  it("contains slug, objective, and dimension table", () => {
    const result = evalPlan(BASE_PLAN);
    const report = renderEvalReport(result);
    expect(report).toContain("test-plan");
    expect(report).toContain("falsifiable-question");
    expect(report).toContain("bounded-scope");
    expect(report).toContain("PASS");
  });

  it("contains FAIL and fix instructions on failure", () => {
    const plan: ResearchPlan = {
      ...BASE_PLAN,
      scope: { hosts: [], paths: [] },
    };
    const result = evalPlan(plan);
    const report = renderEvalReport(result);
    expect(report).toContain("FAIL");
    expect(report).toContain("Blocked");
    expect(report).toContain("bun run ingest");
  });
});
