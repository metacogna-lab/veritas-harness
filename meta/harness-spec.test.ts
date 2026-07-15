/**
 * H-4: HarnessSpec contract, the intent→harness bridge, the loadouts renderer, and
 * spec-driven createHarness scaffolding.
 */
import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  validateHarnessSpec,
  deriveHarnessSpec,
  renderLoadoutsModule,
  type IngestedIntent,
} from "./harness-spec.ts";
import { createHarness } from "./create-harness.ts";
import { readManifest } from "./manifest.ts";

describe("HarnessSpec contract (H-4)", () => {
  it("rejects a spec with no loadouts", () => {
    expect(() => validateHarnessSpec({ name: "x", loadouts: [] })).toThrow("at least one loadout");
  });

  it("rejects a non-kebab-case name", () => {
    expect(() =>
      validateHarnessSpec({
        name: "Bad_Name",
        loadouts: [{ name: "r", specialists: [{ role: "a", focus: "b" }], toolNames: ["t"] }],
      }),
    ).toThrow();
  });
});

describe("deriveHarnessSpec — intent→harness bridge (H-4)", () => {
  it("chooses the host adapter for web targets and path adapter for filesystem", () => {
    const web: IngestedIntent = {
      slug: "recon-example",
      loadout: "web-recon",
      specialists: [{ role: "recon", focus: "map the public API surface" }],
      scope: { hosts: ["example.com"], paths: [] },
    };
    const fs: IngestedIntent = {
      slug: "audit-src",
      loadout: "codebase-audit",
      specialists: [{ role: "auditor", focus: "inspect the safety plane" }],
      scope: { hosts: [], paths: ["src/safety"] },
    };
    expect(deriveHarnessSpec(web).loadouts[0]!.adapter).toBe("host");
    expect(deriveHarnessSpec(fs).loadouts[0]!.adapter).toBe("path");
    // Safe-by-construction default toolset.
    expect(deriveHarnessSpec(fs).loadouts[0]!.toolNames).toContain("read_file");
  });
});

describe("renderLoadoutsModule (H-4)", () => {
  it("emits a module containing the loadout name, roles, and tools", () => {
    const spec = deriveHarnessSpec({
      slug: "demo",
      loadout: "research",
      specialists: [{ role: "researcher", focus: "explore the corpus" }],
      scope: { hosts: [], paths: ["docs"] },
    });
    const src = renderLoadoutsModule(spec);
    expect(src).toContain('name: "research"');
    expect(src).toContain('role: "researcher"');
    expect(src).toContain("read_file");
    expect(src).toContain("generatedLoadouts");
  });
});

describe("createHarness --from-spec (H-4)", () => {
  it("persists the spec + generated loadouts and derives the manifest from it", () => {
    const root = mkdtempSync(join(tmpdir(), "veritas-meta-"));
    try {
      // Minimal fake registry so the pipeline can register without touching the real repo.
      require("node:fs").writeFileSync(join(root, "harnesses.json"), JSON.stringify({ version: 1, harnesses: [] }));
      const spec = deriveHarnessSpec({
        slug: "gen-harness",
        loadout: "research",
        specialists: [{ role: "researcher", focus: "explore the target corpus" }],
        scope: { hosts: [], paths: ["corpus"] },
      });

      const result = createHarness({ root, name: "gen-harness", spec, install: false, test: false });

      expect(existsSync(join(result.path, "HARNESS_SPEC.json"))).toBe(true);
      expect(existsSync(join(result.path, "src", "agent", "loadouts.generated.ts"))).toBe(true);
      const gen = readFileSync(join(result.path, "src", "agent", "loadouts.generated.ts"), "utf8");
      expect(gen).toContain("generatedLoadouts");
      expect(gen).toContain('name: "research"');
      expect(existsSync(join(result.path, "src", "agent", "loadouts.ts"))).toBe(true);
      expect(existsSync(join(result.path, "src", "agent", "specialists.ts"))).toBe(true);
      const manifest = readManifest(result.path);
      expect(manifest.capabilities).toContain("research");
      expect(manifest.description).toContain("HarnessSpec");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("registers generated loadouts into LoadoutRegistry when bun test runs", () => {
    const root = mkdtempSync(join(tmpdir(), "veritas-meta-"));
    try {
      require("node:fs").writeFileSync(join(root, "harnesses.json"), JSON.stringify({ version: 1, harnesses: [] }));
      const spec = deriveHarnessSpec({
        slug: "gen-wired",
        loadout: "research",
        specialists: [{ role: "researcher", focus: "explore" }],
        scope: { hosts: [], paths: ["docs"] },
        toolNames: ["read_file"],
      });
      const result = createHarness({ root, name: "gen-wired", spec, install: true, test: true });
      expect(result.path).toContain("gen-wired");
      // Registry wiring is asserted by the scaffolded loadouts.test.ts (must be green above).
      const gen = readFileSync(join(result.path, "src", "agent", "loadouts.generated.ts"), "utf8");
      expect(gen).toContain('name: "research"');
      expect(gen).toContain("read_file");
      const loadoutsTs = readFileSync(join(result.path, "src", "agent", "loadouts.ts"), "utf8");
      expect(loadoutsTs).toContain("fromGeneratedLoadout");
      expect(loadoutsTs).toContain("generatedLoadouts");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
