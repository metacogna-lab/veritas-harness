import { describe, expect, test } from "bun:test";
import { buildResourcesCatalog } from "./resources-catalog.ts";
import { join } from "node:path";

describe("resources-catalog", () => {
  test("finds lessons.json and resource modules", () => {
    const repoRoot = join(import.meta.dir, "../..");
    const catalog = buildResourcesCatalog({
      repoRoot,
      objective: "scope gate benchmark safety",
      extraSources: ["agents/docs/processed/strategy.md"],
    });
    expect(catalog.resourceModules).toContain("lessons.ts");
    const lessonSrc = catalog.sources.find((s) => s.kind === "lesson");
    expect(lessonSrc?.exists).toBe(true);
    const docSrc = catalog.sources.find((s) => s.path.includes("strategy.md"));
    expect(docSrc?.exists).toBe(true);
  });
});
