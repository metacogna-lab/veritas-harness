import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { loadResearchPlan, planToStartOptions } from "./research-plan.ts";

const FIXTURE = join(import.meta.dir, "../../missions/example-slug/research-plan.json");

describe("research-plan", () => {
  test("loads and validates golden fixture", () => {
    const plan = loadResearchPlan(FIXTURE);
    expect(plan.metadata.slug).toBe("example-slug");
    expect(plan.loadout).toBe("research");
    expect(plan.phases.length).toBeGreaterThan(0);
  });

  test("planToStartOptions maps to control-plane fields", () => {
    const plan = loadResearchPlan(FIXTURE);
    const opts = planToStartOptions(plan);
    expect(opts.objective).toContain("scope-gate");
    expect(opts.loadout).toBe("research");
    expect(opts.target).toBe("bench/scope-gate");
    expect(opts.scope.paths).toContain("bench/scope-gate");
    expect(opts.planNote).toContain("example-slug");
  });
});
