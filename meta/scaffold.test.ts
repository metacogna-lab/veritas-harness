import { test, expect } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyDirWithTokens, isKebabCase, availablePacks, packSkillNames } from "./scaffold.ts";

test("isKebabCase accepts valid names and rejects invalid ones", () => {
  expect(isKebabCase("veritas-research")).toBe(true);
  expect(isKebabCase("a1-b2")).toBe(true);
  expect(isKebabCase("Bad_Name")).toBe(false);
  expect(isKebabCase("-leading")).toBe(false);
  expect(isKebabCase("")).toBe(false);
});

test("copyDirWithTokens substitutes tokens recursively", () => {
  const root = mkdtempSync(join(tmpdir(), "scaf-"));
  try {
    const src = join(root, "src");
    mkdirSync(join(src, "nested"), { recursive: true });
    writeFileSync(join(src, "a.txt"), "name=__HARNESS_NAME__");
    writeFileSync(join(src, "nested", "b.txt"), "__HARNESS_NAME__/__HARNESS_NAME__");
    const dest = join(root, "dest");
    copyDirWithTokens(src, dest, { __HARNESS_NAME__: "alpha" });
    expect(readFileSync(join(dest, "a.txt"), "utf8")).toBe("name=alpha");
    expect(readFileSync(join(dest, "nested", "b.txt"), "utf8")).toBe("alpha/alpha");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the starter capability pack is discoverable and ships a skill", () => {
  const packsRoot = join(import.meta.dir, "templates", "skills");
  expect(availablePacks(packsRoot)).toContain("starter");
  expect(packSkillNames(join(packsRoot, "starter"))).toContain("harness-first-tool");
});
