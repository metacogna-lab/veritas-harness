/**
 * Spine smoke test — verifies the 8-plane stack wires end-to-end without
 * network calls. Uses ScriptedBackbone so no provider key is required.
 */
import { test, expect } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileTool as readFile } from "./tools/read-file.ts";
import { ToolRegistry } from "./tools/registry.ts";
import { Mission } from "./mission/index.ts";
import { Agent } from "./agent/index.ts";
import { ScriptedBackbone } from "./llm/echo.ts";
import type { CompletionResult } from "./llm/types.ts";

const zero = { inputTokens: 0, outputTokens: 0 };

function scripted(steps: CompletionResult[]): ScriptedBackbone {
  return new ScriptedBackbone(steps);
}

test("spine: agent reads an in-scope file and the observation is recorded", async () => {
  const dir = mkdtempSync(join(tmpdir(), "spine-"));
  try {
    const file = join(dir, "note.txt");
    writeFileSync(file, "hello harness");

    const mission = new Mission({ objective: "read the note", scope: { hosts: [], paths: [dir] } });
    const registry = new ToolRegistry().register(readFile);
    const llm = scripted([
      { text: "", toolCalls: [{ name: "read_file", input: { path: file } }], usage: zero },
      { text: "The file says: hello harness", toolCalls: [], usage: zero },
    ]);

    const agent = new Agent({ llm, registry, mission, systemPrompt: "test", maxSteps: 10 });
    const result = await agent.run();

    expect(result.status).toBe("answered");
    const obs = mission.entries.find((e) => e.kind === "observation");
    expect(obs).toBeDefined();
    expect(obs!.content).toContain("hello harness");

    // A finding with a real observation backing is accepted by the provenance gate.
    const accepted = mission.addFinding({
      claim: "note says hello harness",
      provenance: { toolCall: "read_file", observationSeq: obs!.seq },
    });
    expect(accepted.accepted).toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("spine: an out-of-scope read is denied by the gate, observation records the denial", async () => {
  const dir = mkdtempSync(join(tmpdir(), "spine-"));
  try {
    const mission = new Mission({ objective: "try to escape", scope: { hosts: [], paths: [dir] } });
    const registry = new ToolRegistry().register(readFile);
    const llm = scripted([
      { text: "", toolCalls: [{ name: "read_file", input: { path: "/etc/passwd" } }], usage: zero },
      { text: "blocked as expected", toolCalls: [], usage: zero },
    ]);

    const agent = new Agent({ llm, registry, mission, systemPrompt: "test", maxSteps: 10 });
    await agent.run();

    const obs = mission.entries.find((e) => e.kind === "observation");
    expect(obs).toBeDefined();
    expect(obs!.content).toContain("SCOPE DENIED");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
