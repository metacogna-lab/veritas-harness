import { test, expect } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PLANES } from "./registry.ts";

const templateDir = join(import.meta.dir, "templates", "harness-template");

test("template ships a file for every plane the registry knows about", () => {
  // Map each plane to a representative source dir/file in the template.
  const planeFiles: Record<string, string> = {
    provider: "src/llm/types.ts",
    safety: "src/safety/scope.ts",
    verification: "src/evidence/gate.ts",
    memory: "src/mission/index.ts",
    capability: "src/tools/registry.ts",
    execution: "src/agent/index.ts",
    orchestration: "src/planes.ts", // documented as roadmap; plane map records the boundary
    control: "src/cli.ts",
  };
  for (const plane of PLANES) {
    const rel = planeFiles[plane];
    expect(rel, `no template file mapped for plane "${plane}"`).toBeDefined();
    expect(existsSync(join(templateDir, rel!)), `missing ${rel} for plane ${plane}`).toBe(true);
  }
});

test("template package.json carries the __HARNESS_NAME__ token for the scaffolder", () => {
  const pkg = readFileSync(join(templateDir, "package.json"), "utf8");
  expect(pkg).toContain("__HARNESS_NAME__");
});

test("template ships its own passing tests (spine + pure planes)", () => {
  expect(existsSync(join(templateDir, "src/spine.test.ts"))).toBe(true);
  expect(existsSync(join(templateDir, "src/safety/scope.test.ts"))).toBe(true);
  expect(existsSync(join(templateDir, "src/parse/json.test.ts"))).toBe(true);
});
