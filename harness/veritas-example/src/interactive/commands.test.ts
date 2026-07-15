/**
 * Slash-command parser + help coverage for the interactive shell.
 */
import { describe, expect, test } from "bun:test";
import { parseSlash, isSlash, renderHelp, KNOWN_COMMANDS } from "./commands.ts";

describe("isSlash", () => {
  test("detects leading slash (with leading whitespace)", () => {
    expect(isSlash("/help")).toBe(true);
    expect(isSlash("  /plan")).toBe(true);
    expect(isSlash("draft a plan")).toBe(false);
  });
});

describe("parseSlash", () => {
  test("parses name and args", () => {
    expect(parseSlash("/plan --json")).toEqual({
      name: "plan",
      args: "--json",
      tokens: ["--json"],
    });
  });

  test("parses bare command", () => {
    expect(parseSlash("/help")).toEqual({ name: "help", args: "", tokens: [] });
  });

  test("lowercases command name", () => {
    expect(parseSlash("/WRITE")).toEqual({ name: "write", args: "", tokens: [] });
  });

  test("returns null for non-slash lines", () => {
    expect(parseSlash("hello")).toBeNull();
  });

  test("empty slash yields empty name", () => {
    expect(parseSlash("/")).toEqual({ name: "", args: "", tokens: [] });
  });
});

describe("renderHelp", () => {
  test("lists known commands", () => {
    const text = renderHelp();
    expect(text).toContain("/help");
    expect(text).toContain("/write");
    expect(text).toContain("/ingest");
    expect(KNOWN_COMMANDS.has("exit")).toBe(true);
    expect(KNOWN_COMMANDS.has("frobnicate")).toBe(false);
  });
});
