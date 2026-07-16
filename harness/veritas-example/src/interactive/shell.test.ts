/**
 * Interactive shell — scripted readline sequences (no real TTY).
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LLMBackbone } from "@spine/llm/index.ts";
import type { ResearchPlan } from "../ingest/schema.ts";
import { runShell } from "./shell.ts";
import { run } from "../cli.ts";

const STRONG_PLAN: ResearchPlan = {
  version: "1",
  metadata: {
    slug: "shell-demo",
    ingestedAt: "2026-07-15T00:00:00.000Z",
    ingestVersion: "0.1.0",
    model: "fake",
  },
  objective:
    "Measure whether interactive /write blocks until dogma PASS with at least 2 phases",
  loadout: "research",
  target: "src/interactive",
  scope: { hosts: [], paths: ["src/interactive"] },
  specialists: [{ role: "researcher", focus: "verify shell commands" }],
  phases: [
    { id: "draft", description: "Draft plan via chat" },
    { id: "gate", description: "Run dogma and write" },
  ],
  sources: [{ kind: "doc", path: "docs/CLI.md" }],
  lessons: [],
  successCriteria: ["verify at least 1 scripted shell session exits 0"],
};

function scriptAsk(lines: string[]): (prompt: string) => Promise<string | null> {
  const queue = [...lines];
  return async () => {
    if (queue.length === 0) return null;
    return queue.shift()!;
  };
}

function mockLLM(plan: ResearchPlan): () => LLMBackbone {
  return () =>
    ({
      complete: async () => ({
        text: JSON.stringify(plan),
        toolCalls: [],
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    }) as unknown as LLMBackbone;
}

describe("runShell", () => {
  test("/help then /quit", async () => {
    const out: string[] = [];
    const err: string[] = [];
    const code = await runShell({
      buildLLM: mockLLM(STRONG_PLAN),
      banner: false,
      print: (l) => out.push(l),
      printErr: (l) => err.push(l),
      ask: scriptAsk(["/help", "/quit"]),
    });
    expect(code).toBe(0);
    expect(out.join("\n")).toContain("/write");
    expect(out.join("\n")).toContain("bye");
    expect(err).toEqual([]);
  });

  test("unknown slash → stderr, then quit", async () => {
    const out: string[] = [];
    const err: string[] = [];
    await runShell({
      buildLLM: mockLLM(STRONG_PLAN),
      banner: false,
      print: (l) => out.push(l),
      printErr: (l) => err.push(l),
      ask: scriptAsk(["/frobnicate", "/quit"]),
    });
    expect(err.join("\n")).toContain("unknown command /frobnicate");
  });

  test("chat → draft → /eval → /write (dogma pass) → /quit", async () => {
    const root = mkdtempSync(join(tmpdir(), "veritas-shell-"));
    try {
      const out: string[] = [];
      const err: string[] = [];
      const code = await runShell({
        buildLLM: mockLLM(STRONG_PLAN),
        banner: false,
        harnessRoot: root,
        print: (l) => out.push(l),
        printErr: (l) => err.push(l),
        ask: scriptAsk([
          "I want a falsifiable plan for the interactive shell write gate",
          "/eval",
          "/write",
          "/plan",
          "/quit",
        ]),
      });
      expect(code).toBe(0);
      const text = out.join("\n");
      expect(text).toContain("Draft updated");
      expect(text).toContain("PASS");
      expect(text).toContain(`wrote ${join(root, "missions", "shell-demo", "research-plan.json")}`);
      expect(text).toContain("slug:       shell-demo");
      expect(err.filter((e) => e.includes("/write blocked"))).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("/write blocked when draft fails dogma", async () => {
    const weak: ResearchPlan = {
      ...STRONG_PLAN,
      objective: "explore briefly",
      phases: [{ id: "p1", description: "one phase only" }],
      successCriteria: ["done"],
    };
    const root = mkdtempSync(join(tmpdir(), "veritas-shell-weak-"));
    try {
      const err: string[] = [];
      await runShell({
        buildLLM: mockLLM(weak),
        banner: false,
        harnessRoot: root,
        print: () => {},
        printErr: (l) => err.push(l),
        ask: scriptAsk(["make a weak plan", "/write", "/quit"]),
      });
      expect(err.join("\n")).toContain("/write blocked");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("/loadouts lists registered loadouts", async () => {
    const out: string[] = [];
    await runShell({
      buildLLM: mockLLM(STRONG_PLAN),
      banner: false,
      print: (l) => out.push(l),
      printErr: () => {},
      ask: scriptAsk(["/loadouts", "/quit"]),
    });
    expect(out.join("\n")).toContain("research");
  });
});

describe("cli interactive entry", () => {
  test("interactive verb enters shell (scripted quit)", async () => {
    const out: string[] = [];
    const code = await run({
      argv: ["interactive"],
      banner: false,
      isTTY: false,
      print: (l) => out.push(l),
      printErr: () => {},
      buildLLM: mockLLM(STRONG_PLAN),
      ask: scriptAsk(["/quit"]),
    });
    expect(code).toBe(0);
    expect(out.join("\n")).toContain("Interactive mode");
  });

  test("bare argv + isTTY enters shell", async () => {
    const out: string[] = [];
    const code = await run({
      argv: [],
      banner: false,
      isTTY: true,
      print: (l) => out.push(l),
      printErr: () => {},
      buildLLM: mockLLM(STRONG_PLAN),
      ask: scriptAsk(["/quit"]),
    });
    expect(code).toBe(0);
    expect(out.join("\n")).toContain("Interactive mode");
  });

  test("bare argv without TTY still returns usage (no hang)", async () => {
    const err: string[] = [];
    const code = await run({
      argv: [],
      banner: false,
      isTTY: false,
      print: () => {},
      printErr: (l) => err.push(l),
      buildLLM: mockLLM(STRONG_PLAN),
    });
    expect(code).toBe(2);
    expect(err.join("\n")).toContain("usage: veritas");
  });
});
