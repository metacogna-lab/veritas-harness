/**
 * Functional coverage for core/plan-io.ts (veritas-v0.2 H-1). Round-trips a plan
 * through writePlan → loadPlan in a temp dir. Imports the real shared module (this
 * is a test, not shipped in the Docker image, so the cross-package import is fine).
 */
import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writePlan, loadPlan } from "../../../../core/plan-io.ts";
import type { ResearchPlan } from "../../../../core/schema.ts";

function samplePlan(slug: string): ResearchPlan {
  return {
    version: "1",
    metadata: { slug, ingestedAt: new Date().toISOString(), ingestVersion: "0.1.0", model: "test" },
    objective: "Verify the scope gate denies loopback by inspecting the predicate line by line",
    loadout: "research",
    target: "src/safety",
    scope: { hosts: [], paths: ["src/safety"] },
    specialists: [
      { role: "researcher", focus: "read the scope predicate" },
      { role: "analyst", focus: "synthesise the containment findings" },
    ],
    phases: [
      { id: "p1", description: "read scope.ts and enumerate deny branches" },
      { id: "p2", description: "confirm loopback and private ranges are denied" },
    ],
    sources: [],
    lessons: [],
    successCriteria: ["verify at least 2 deny branches are exercised"],
  } as ResearchPlan;
}

describe("core/plan-io (H-1)", () => {
  it("writePlan then loadPlan round-trips an identical plan", () => {
    const dir = mkdtempSync(join(tmpdir(), "veritas-planio-"));
    try {
      const plan = samplePlan("round-trip");
      const path = writePlan(dir, plan);
      expect(path).toContain(join("round-trip", "research-plan.json"));
      expect(existsSync(path)).toBe(true);
      const loaded = loadPlan(path);
      expect(loaded.objective).toBe(plan.objective);
      expect(loaded.metadata.slug).toBe("round-trip");
      expect(loaded.scope.paths).toEqual(["src/safety"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writePlan rejects an unsafe slug", () => {
    const dir = mkdtempSync(join(tmpdir(), "veritas-planio-"));
    try {
      const bad = samplePlan("../escape") as ResearchPlan;
      bad.metadata.slug = "../escape";
      expect(() => writePlan(dir, bad)).toThrow("unsafe slug");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
