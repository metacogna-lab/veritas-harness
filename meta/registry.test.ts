import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  emptyRegistry,
  addHarness,
  nextIndex,
  findByName,
  readRegistry,
  writeRegistry,
  registrySchema,
  type HarnessEntry,
} from "./registry.ts";

const entry = (name: string, index: number): HarnessEntry => ({
  name,
  index,
  path: `harness/${name}`,
  capabilities: [],
  planes: [
    "provider",
    "safety",
    "verification",
    "memory",
    "capability",
    "execution",
    "orchestration",
    "control",
  ],
  createdAt: "2026-07-09",
  status: "active",
});

test("nextIndex starts at 1 and increments past the max", () => {
  let reg = emptyRegistry();
  expect(nextIndex(reg)).toBe(1);
  reg = addHarness(reg, entry("alpha", nextIndex(reg)));
  expect(nextIndex(reg)).toBe(2);
  reg = addHarness(reg, entry("beta", nextIndex(reg)));
  expect(nextIndex(reg)).toBe(3);
});

test("addHarness is immutable — original registry is unchanged", () => {
  const reg = emptyRegistry();
  const next = addHarness(reg, entry("alpha", 1));
  expect(reg.harnesses).toHaveLength(0);
  expect(next.harnesses).toHaveLength(1);
  expect(next).not.toBe(reg);
});

test("addHarness rejects duplicate names", () => {
  const reg = addHarness(emptyRegistry(), entry("alpha", 1));
  expect(() => addHarness(reg, entry("alpha", 2))).toThrow(/already registered/);
});

test("registrySchema rejects non-kebab-case names", () => {
  const bad = { version: 1, harnesses: [{ ...entry("Bad_Name", 1) }] };
  expect(registrySchema.safeParse(bad).success).toBe(false);
});

test("readRegistry returns empty for a missing file, and round-trips a write", () => {
  const dir = mkdtempSync(join(tmpdir(), "reg-"));
  try {
    expect(readRegistry(dir).harnesses).toHaveLength(0);
    const reg = addHarness(emptyRegistry(), entry("alpha", 1));
    writeRegistry(dir, reg);
    const back = readRegistry(dir);
    expect(back.harnesses).toHaveLength(1);
    expect(findByName(back, "alpha")?.index).toBe(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the committed root registry validates and lists veritas-research as #1", () => {
  const root = join(import.meta.dir, "..");
  const reg = readRegistry(root);
  const v = findByName(reg, "veritas-research");
  expect(v).toBeDefined();
  expect(v?.index).toBe(1);
  // veritas-research is the PURE 8-plane template — it carries no domain capabilities.
  // The "research" capability lives on veritas-example (the domain harness).
  expect(v?.capabilities).toEqual([]);
  const example = findByName(reg, "veritas-example");
  expect(example?.capabilities).toContain("research");
});
