import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseIntentFile, parseSections, parseSimpleYaml } from "./parse-intent.ts";

const EXAMPLE = join(import.meta.dir, "../../ingest/examples/scope-gate-study.NEW.md");

describe("parse-intent", () => {
  test("parses example NEW.md frontmatter and sections", () => {
    const intent = parseIntentFile(readFileSync(EXAMPLE, "utf8"));
    expect(intent.frontmatter.slug).toBe("scope-gate-study");
    expect(intent.frontmatter.title).toContain("scope-gate");
    expect(intent.frontmatter.loadout_hint).toBe("research");
    expect(intent.sections.question).toContain("pass@1");
    expect(intent.sections.scope).toContain("bench/scope-gate");
    expect(intent.frontmatter.sources).toContain("agents/docs/processed/strategy.md");
  });

  test("parseSimpleYaml handles list values", () => {
    const yaml = parseSimpleYaml("title: Test\nsources:\n  - a.md\n  - b.md\n");
    expect(yaml.title).toBe("Test");
    expect(yaml.sources).toEqual(["a.md", "b.md"]);
  });

  test("parseSections extracts ## headings", () => {
    const body = "## Question\nWhat is X?\n\n## Scope\nIn: foo\n";
    const sections = parseSections(body);
    expect(sections.question).toBe("What is X?");
    expect(sections.scope).toBe("In: foo");
  });

  test("throws without frontmatter", () => {
    expect(() => parseIntentFile("# No frontmatter")).toThrow("frontmatter");
  });
});
