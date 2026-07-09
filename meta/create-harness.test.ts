import { test, expect } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHarness } from "./create-harness.ts";
import { readRegistry, findByName } from "./registry.ts";
import { readManifest } from "./manifest.ts";

// install/test are skipped in unit tests (no bun subprocess); the scaffold + registry
// wiring is what we assert here. The install+test path is exercised by the F2 E2E run.
function scaffold(root: string, name: string, capabilities: string[] = []) {
  return createHarness({ root, name, capabilities, install: false, test: false });
}

test("createHarness scaffolds a token-free 8-plane harness and registers it as #1", () => {
  const root = mkdtempSync(join(tmpdir(), "ch-"));
  try {
    const result = scaffold(root, "demo-harness", ["starter"]);
    expect(result.index).toBe(1);

    const dir = join(root, "harness", "demo-harness");
    expect(existsSync(join(dir, "src", "agent", "index.ts"))).toBe(true);
    expect(existsSync(join(dir, "src", "safety", "scope.ts"))).toBe(true);

    // token fully substituted
    const pkg = readFileSync(join(dir, "package.json"), "utf8");
    expect(pkg).toContain('"name": "demo-harness"');
    expect(pkg).not.toContain("__HARNESS_NAME__");

    // capability pack installed as a harness-owned skill
    expect(existsSync(join(dir, "skills", "harness-first-tool", "SKILL.md"))).toBe(true);
    const manifest = readManifest(dir);
    expect(manifest.skills).toContain("harness-first-tool");
    expect(manifest.capabilities).toEqual(["starter"]);

    // registry updated
    expect(findByName(readRegistry(root), "demo-harness")?.index).toBe(1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("createHarness assigns monotonic indices and refuses duplicates", () => {
  const root = mkdtempSync(join(tmpdir(), "ch-"));
  try {
    expect(scaffold(root, "one").index).toBe(1);
    expect(scaffold(root, "two").index).toBe(2);
    expect(() => scaffold(root, "one")).toThrow(/already registered/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("createHarness rejects bad names and unknown capabilities", () => {
  const root = mkdtempSync(join(tmpdir(), "ch-"));
  try {
    expect(() => scaffold(root, "Bad_Name")).toThrow(/kebab-case/);
    expect(() => scaffold(root, "ok-name", ["nope"])).toThrow(/unknown capability/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
