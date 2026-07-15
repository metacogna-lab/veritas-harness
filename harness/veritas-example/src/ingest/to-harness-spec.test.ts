/**
 * H-4 bridge: ResearchPlan → HarnessSpec (creation remains in meta/).
 */
import { describe, expect, test } from "bun:test";
import type { ResearchPlan } from "./schema.ts";
import { planToIngestedIntent, researchPlanToHarnessSpec } from "./to-harness-spec.ts";

const PLAN: ResearchPlan = {
  version: "1",
  metadata: {
    slug: "scope-gate-study",
    ingestedAt: "2026-07-15T00:00:00.000Z",
    ingestVersion: "0.1.0",
    model: "test",
  },
  objective: "Measure whether off-scope hosts are denied",
  loadout: "codebase-audit",
  target: "src/safety",
  scope: { hosts: [], paths: ["src/safety"] },
  specialists: [{ role: "auditor", focus: "inspect the scope gate" }],
  phases: [
    { id: "read", description: "Read scope.ts" },
    { id: "probe", description: "Probe deny paths" },
  ],
  sources: [],
  lessons: [],
  successCriteria: ["off-scope calls return SCOPE DENIED"],
};

describe("researchPlanToHarnessSpec", () => {
  test("derives a path-adapter spec named after the plan slug", () => {
    const spec = researchPlanToHarnessSpec(PLAN);
    expect(spec.name).toBe("scope-gate-study");
    expect(spec.loadouts[0]!.adapter).toBe("path");
    expect(spec.loadouts[0]!.name).toBe("codebase-audit");
    expect(spec.capabilities).toContain("research");
  });

  test("planToIngestedIntent preserves specialists and scope", () => {
    const intent = planToIngestedIntent(PLAN);
    expect(intent.specialists[0]!.role).toBe("auditor");
    expect(intent.scope.paths).toEqual(["src/safety"]);
  });
});
