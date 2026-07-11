/**
 * INT end-to-end: the full spine under test.
 *
 * scope gate → tool call → observation → record_finding (evidence gate) →
 * refuter → confirmed → reproducible report. This is the INT Definition of Done
 * exercised as an assertion, not just demonstrated by the gen script.
 */
import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ControlPlane } from "./plane.ts";
import { MissionStore } from "./store.ts";
import { LLMBackbone } from "../llm/index.ts";
import { LoadoutRegistry } from "../agent/specialists.ts";
import type { Loadout } from "../agent/specialists.ts";
import type { Transport, TransportResponse } from "../llm/types.ts";
import type { ProviderConfig } from "../config/index.ts";

const auditLoadout: Loadout = {
  name: "codebase-audit",
  description: "Read and audit a filesystem scope.",
  toolNames: ["read_file", "list_dir", "record_finding"],
  specialists: [
    {
      role: "auditor",
      systemPrompt: "You are a meticulous code auditor. Explore within scope. Record every finding.",
      toolAllowlist: ["read_file", "list_dir", "record_finding"],
    },
  ],
  targetAdapter: {
    name: "filesystem",
    buildScope: (target) => ({ hosts: [], paths: [target] }),
    describeScope: (scope) => `paths: ${scope.paths.join(", ")}`,
  },
};

const loadouts = new LoadoutRegistry().register(auditLoadout);

const cfg: ProviderConfig = {
  provider: "anthropic",
  model: "fake",
  apiKey: "sk-test-000000000000",
  baseUrl: "http://localhost",
  maxTokens: 100,
  temperature: 0,
};
const zero = { inputTokens: 0, outputTokens: 0 };

function scripted(responses: TransportResponse[]): LLMBackbone {
  let i = 0;
  const transport: Transport = async (): Promise<TransportResponse> => responses[Math.min(i++, responses.length - 1)]!;
  return new LLMBackbone({ configs: [cfg], transport, sleep: async () => {} });
}

/** Evidence-grounded skeptic: confirms only when evidence contains the claim. */
function skeptic(): LLMBackbone {
  const transport: Transport = async (_c, req): Promise<TransportResponse> => {
    const content = req.messages[0]!.content;
    const claim = content.split("CLAIM:\n")[1]!.split("\n\nEVIDENCE")[0]!.trim().toLowerCase();
    const evidence = content.split("EVIDENCE")[1]!.toLowerCase();
    const supported = evidence.includes(claim);
    return {
      text: JSON.stringify({ verdict: supported ? "confirmed" : "retracted", reason: supported ? "supported" : "unsupported" }),
      usage: zero,
    };
  };
  return new LLMBackbone({ configs: [cfg], transport, sleep: async () => {} });
}

describe("INT full-spine end-to-end", () => {
  test("mission produces a finding, refuter confirms it, report is reproducible", async () => {
    const dir = await mkdtemp(join(tmpdir(), "veritas-int-"));
    const file = join(dir, "app.ts");
    await writeFile(file, "export const debug = true;");
    const runs = await mkdtemp(join(tmpdir(), "veritas-int-runs-"));
    const store = new MissionStore(runs);

    // read_file lands at seq 4 (0 objective, 1 status, 2 model, 3 tool_call, 4 observation).
    const main = scripted([
      { text: "", nativeToolCalls: [{ name: "read_file", input: { path: file } }], usage: zero },
      { text: "", nativeToolCalls: [{ name: "record_finding", input: { claim: "debug = true", observationSeq: 4 } }], usage: zero },
      { text: "app.ts sets debug = true.", usage: zero },
    ]);

    const plane = new ControlPlane({ llm: main, store, refuterLLM: skeptic(), loadouts });
    const { id, result, snapshot } = await plane.start({
      objective: "audit app.ts for a debug flag",
      target: dir,
      loadout: "codebase-audit",
    });

    expect(result.status).toBe("answered");
    expect(snapshot.status).toBe("done");

    // Exactly one finding, confirmed, backed by a REAL observation.
    expect(snapshot.findings).toHaveLength(1);
    const finding = snapshot.findings[0]!;
    expect(finding.status).toBe("confirmed");
    const backing = snapshot.transcript.find((e) => e.seq === finding.provenance.observationSeq);
    expect(backing?.kind).toBe("observation");
    expect(backing?.content).toContain("debug = true");

    // The report re-derives the finding from the committed snapshot.
    const report = plane.report(id)!;
    expect(report).toContain("[confirmed] debug = true");
  });

  test("a finding whose evidence does not support it is retracted, not confirmed", async () => {
    const dir = await mkdtemp(join(tmpdir(), "veritas-int-"));
    const file = join(dir, "app.ts");
    await writeFile(file, "export const debug = true;");
    const runs = await mkdtemp(join(tmpdir(), "veritas-int-runs-"));
    const store = new MissionStore(runs);

    const main = scripted([
      { text: "", nativeToolCalls: [{ name: "read_file", input: { path: file } }], usage: zero },
      { text: "", nativeToolCalls: [{ name: "record_finding", input: { claim: "the app enforces TLS 1.3", observationSeq: 4 } }], usage: zero },
      { text: "done.", usage: zero },
    ]);

    const plane = new ControlPlane({ llm: main, store, refuterLLM: skeptic(), loadouts });
    const { snapshot } = await plane.start({ objective: "audit", target: dir, loadout: "codebase-audit" });
    expect(snapshot.findings[0]!.status).toBe("retracted");
  });
});
