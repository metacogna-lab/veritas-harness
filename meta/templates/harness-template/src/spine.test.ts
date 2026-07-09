import { test, expect } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ToolRegistry } from "./tools/registry.ts";
import { readFile } from "./tools/read-file.ts";
import { Mission } from "./mission/index.ts";
import { runAgent, scopeOnlyCheck } from "./agent/index.ts";
import { ScriptedBackbone } from "./llm/echo.ts";

test("spine: agent reads an in-scope file, records provenance, and a backed finding is accepted", async () => {
  const dir = mkdtempSync(join(tmpdir(), "spine-"));
  try {
    const file = join(dir, "note.txt");
    writeFileSync(file, "hello harness");

    const mission = new Mission("read the note", { hosts: [], paths: [dir] });
    const registry = new ToolRegistry().register(readFile);
    const llm = new ScriptedBackbone([
      { text: "reading", toolCalls: [{ name: "read_file", input: { path: file } }] },
      { text: '{"action":"final","answer":"read it"}', toolCalls: [] },
    ]);

    const result = await runAgent({ llm, registry, mission, system: "test", safetyCheck: scopeOnlyCheck(mission.scope) });

    expect(result.stopped).toBe(false);
    expect(mission.log).toHaveLength(1);
    expect(mission.log[0]!.ok).toBe(true);
    expect(mission.log[0]!.observation).toContain("hello harness");

    // A finding backed by the real observation is accepted...
    expect(mission.addFinding({ claim: "note says hello", evidenceRef: "read_file" }).ok).toBe(true);
    // ...but one with no backing observation is rejected (invariant #3).
    expect(mission.addFinding({ claim: "unsupported", evidenceRef: "http_get" }).ok).toBe(false);
    expect(mission.findings).toHaveLength(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("spine: an out-of-scope read is denied by the gate, not executed", async () => {
  const dir = mkdtempSync(join(tmpdir(), "spine-"));
  try {
    const mission = new Mission("try to escape", { hosts: [], paths: [dir] });
    const registry = new ToolRegistry().register(readFile);
    const llm = new ScriptedBackbone([
      { text: "escaping", toolCalls: [{ name: "read_file", input: { path: "/etc/passwd" } }] },
      { text: '{"action":"final","answer":"blocked"}', toolCalls: [] },
    ]);

    await runAgent({ llm, registry, mission, system: "test", safetyCheck: scopeOnlyCheck(mission.scope) });

    expect(mission.log[0]!.ok).toBe(false);
    expect(mission.log[0]!.observation).toContain("SCOPE DENIED");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
