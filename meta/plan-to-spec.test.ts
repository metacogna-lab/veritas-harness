/**
 * Intent→spec bridge (H-4), consolidated at the meta root. Verifies a domain
 * ResearchPlan-shaped object derives a HarnessSpec without meta importing the
 * domain schema (structural typing via HarnessPlanInput).
 */
import { describe, expect, test } from "bun:test";
import { planToIngestedIntent, researchPlanToHarnessSpec, type HarnessPlanInput } from "./harness-spec.ts";

// Structurally a ResearchPlan; extra domain fields are allowed by structural typing.
const PLAN: HarnessPlanInput = {
  metadata: { slug: "scope-gate-study" },
  loadout: "codebase-audit",
  scope: { hosts: [], paths: ["src/safety"] },
  specialists: [{ role: "auditor", focus: "inspect the scope gate" }],
};

describe("researchPlanToHarnessSpec (meta)", () => {
  test("derives a path-adapter spec named after the plan slug", () => {
    const spec = researchPlanToHarnessSpec(PLAN);
    expect(spec.name).toBe("scope-gate-study");
    expect(spec.loadouts[0]!.adapter).toBe("path");
    expect(spec.loadouts[0]!.name).toBe("codebase-audit");
    expect(spec.capabilities).toContain("research");
  });

  test("host scope selects the host adapter", () => {
    const spec = researchPlanToHarnessSpec({
      ...PLAN,
      scope: { hosts: ["example.com"], paths: [] },
    });
    expect(spec.loadouts[0]!.adapter).toBe("host");
  });

  test("planToIngestedIntent preserves specialists and scope", () => {
    const intent = planToIngestedIntent(PLAN);
    expect(intent.specialists[0]!.role).toBe("auditor");
    expect(intent.scope.paths).toEqual(["src/safety"]);
  });

  test("capabilities override defaults to research", () => {
    expect(planToIngestedIntent(PLAN).capabilities).toEqual(["research"]);
    expect(planToIngestedIntent(PLAN, ["starter"]).capabilities).toEqual(["starter"]);
  });
});
