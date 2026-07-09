import { test, expect } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PLANES, PLANE_NAMES } from "./planes.ts";

const harnessRoot = join(import.meta.dir, "..");

test("all eight planes are named", () => {
  expect(PLANE_NAMES).toHaveLength(8);
  expect(PLANE_NAMES).toEqual([
    "provider",
    "safety",
    "verification",
    "memory",
    "capability",
    "execution",
    "orchestration",
    "control",
  ]);
});

test("every plane maps to modules that actually exist on disk (guards against drift)", () => {
  for (const name of PLANE_NAMES) {
    const spec = PLANES[name];
    expect(spec.modules.length, `plane ${name} has no modules`).toBeGreaterThan(0);
    for (const mod of spec.modules) {
      expect(existsSync(join(harnessRoot, mod)), `plane ${name}: missing ${mod}`).toBe(true);
    }
  }
});

test("the memory plane covers both durable ledger and ephemeral window", () => {
  const mods = PLANES.memory.modules.join(" ");
  expect(mods).toContain("mission");
  expect(mods).toContain("context-window");
});
