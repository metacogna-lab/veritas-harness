/**
 * CLI coverage (v0.2 M-5). Exercises the verb-dispatch table + exit codes through
 * the injectable `run(deps)` entry — no network, no API key, no process.exit. This is
 * the safety net that made the M-5 verb-table + B3 typed-intake refactor safe.
 */
import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "./cli.ts";
import type { LLMBackbone } from "./llm/index.ts";

/** Run the CLI with captured output and an inert LLM (status/report never call it). */
async function runCli(argv: string[]): Promise<{ code: number; out: string[]; err: string[] }> {
  const out: string[] = [];
  const err: string[] = [];
  const runsDir = mkdtempSync(join(tmpdir(), "veritas-cli-"));
  try {
    const code = await run({
      argv,
      print: (l) => out.push(l),
      printErr: (l) => err.push(l),
      buildLLM: () => ({}) as unknown as LLMBackbone,
      runsDir,
      banner: false,
    });
    return { code, out, err };
  } finally {
    rmSync(runsDir, { recursive: true, force: true });
  }
}

describe("cli dispatch (M-5)", () => {
  it("no verb → usage, exit 2", async () => {
    const { code, err } = await runCli([]);
    expect(code).toBe(2);
    expect(err.join("\n")).toContain("usage: veritas");
  });

  it("unknown verb → usage, exit 2", async () => {
    const { code, err } = await runCli(["frobnicate"]);
    expect(code).toBe(2);
    expect(err.join("\n")).toContain("usage: veritas");
  });

  it("loadouts → lists the registered loadouts, exit 0", async () => {
    const { code, out } = await runCli(["loadouts"]);
    expect(code).toBe(0);
    const text = out.join("\n");
    expect(text).toContain("research");
    expect(text).toContain("codebase-audit");
    expect(text).toContain("web-recon");
  });

  it("status without an id → usage, exit 2", async () => {
    const { code, err } = await runCli(["status"]);
    expect(code).toBe(2);
    expect(err.join("\n")).toContain("status <id>");
  });

  it("status for an unknown id → message, exit 1", async () => {
    const { code, out } = await runCli(["status", "m_missing"]);
    expect(code).toBe(1);
    expect(out.join("\n")).toContain("unknown mission m_missing");
  });

  it("report for an unknown id → exit 1", async () => {
    const { code, out } = await runCli(["report", "m_missing"]);
    expect(code).toBe(1);
    expect(out.join("\n")).toContain("unknown mission m_missing");
  });

  it("eval without --plan → usage, exit 2", async () => {
    const { code, err } = await runCli(["eval"]);
    expect(code).toBe(2);
    expect(err.join("\n")).toContain("eval --plan");
  });

  it("eval with a missing plan file → error, exit 1", async () => {
    const { code, err } = await runCli(["eval", "--plan", "/nope/missing-plan.json"]);
    expect(code).toBe(1);
    expect(err.join("\n")).toContain("eval:");
  });

  it("ingest without --input → usage, exit 2", async () => {
    const { code, err } = await runCli(["ingest"]);
    expect(code).toBe(2);
    expect(err.join("\n")).toContain("ingest --input");
  });

  it("start without objective/target and no plan → usage, exit 2", async () => {
    const { code, err } = await runCli(["start"]);
    expect(code).toBe(2);
    expect(err.join("\n")).toContain("start");
  });

  it("rsi → runs the dry-run and reports, exit 0", async () => {
    const { code, out } = await runCli(["rsi"]);
    expect(code).toBe(0);
    expect(out.join("\n").toLowerCase()).toContain("dry-run");
  });
});
