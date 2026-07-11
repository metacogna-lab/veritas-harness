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

const cfg: ProviderConfig = {
  provider: "anthropic",
  model: "fake",
  apiKey: "sk-test-000000000000",
  baseUrl: "http://localhost",
  maxTokens: 100,
  temperature: 0,
};
const zero = { inputTokens: 0, outputTokens: 0 };

function scriptedLLM(responses: TransportResponse[]): LLMBackbone {
  let i = 0;
  const transport: Transport = async (): Promise<TransportResponse> => responses[Math.min(i++, responses.length - 1)]!;
  return new LLMBackbone({ configs: [cfg], transport, sleep: async () => {} });
}

async function tmpStore() {
  const dir = await mkdtemp(join(tmpdir(), "veritas-runs-"));
  return new MissionStore(dir);
}

/** Minimal loadout for tests — reads files from a filesystem scope. */
const fsLoadout: Loadout = {
  name: "fs-test",
  description: "test filesystem loadout",
  toolNames: ["read_file", "list_dir"],
  specialists: [
    {
      role: "reader",
      systemPrompt: "Read files and report findings.",
      toolAllowlist: ["read_file", "list_dir"],
    },
  ],
  targetAdapter: {
    name: "filesystem",
    buildScope: (target) => ({ hosts: [], paths: [target] }),
    describeScope: (scope) => `paths: ${scope.paths.join(", ")}`,
  },
};

function loadoutsWithFs(): LoadoutRegistry {
  return new LoadoutRegistry().register(fsLoadout);
}

describe("ControlPlane lifecycle", () => {
  test("start → done, persists a snapshot that status/report can read", async () => {
    const dir = await mkdtemp(join(tmpdir(), "veritas-code-"));
    const file = join(dir, "app.ts");
    await writeFile(file, "export const debug = true;");
    const store = await tmpStore();

    const llm = scriptedLLM([
      { text: "", nativeToolCalls: [{ name: "read_file", input: { path: file } }], usage: zero },
      { text: "The module exports a debug flag set to true.", usage: zero },
    ]);
    const plane = new ControlPlane({ llm, store, loadouts: loadoutsWithFs() });

    const events: string[] = [];
    const { id, result } = await plane.start({
      objective: "summarize app.ts",
      target: dir,
      loadout: "fs-test",
      onEvent: (l) => events.push(l),
    });

    expect(result.status).toBe("answered");
    expect(plane.status(id)).toBe("done");
    const report = plane.report(id)!;
    expect(report).toContain("Objective: summarize app.ts");
    expect(report).toContain("Status: done");
    expect(events.some((l) => l.includes("started"))).toBe(true);
    expect(events.some((l) => l.includes("answered"))).toBe(true);
  });

  test("scope enforced by loadout adapter: off-scope read is blocked end-to-end", async () => {
    const store = await tmpStore();
    const dir = await mkdtemp(join(tmpdir(), "veritas-code-"));
    const llm = scriptedLLM([
      { text: "", nativeToolCalls: [{ name: "read_file", input: { path: "/etc/passwd" } }], usage: zero },
      { text: "I could not read outside the authorized scope.", usage: zero },
    ]);
    const plane = new ControlPlane({ llm, store, loadouts: loadoutsWithFs() });
    const { id } = await plane.start({ objective: "read secrets", target: dir, loadout: "fs-test" });
    const snap = store.load(id)!;
    const obs = snap.transcript.find((e) => e.kind === "observation")!;
    expect(obs.content).toStartWith("SCOPE DENIED:");
  });

  test("unknown loadout throws with the available list", async () => {
    const store = await tmpStore();
    const plane = new ControlPlane({ llm: scriptedLLM([{ text: "x", usage: zero }]), store, loadouts: loadoutsWithFs() });
    await expect(plane.start({ objective: "x", target: "/tmp", loadout: "nope" })).rejects.toThrow("unknown loadout");
  });

  test("no loadouts registered throws when start is called", async () => {
    const store = await tmpStore();
    const plane = new ControlPlane({ llm: scriptedLLM([{ text: "x", usage: zero }]), store });
    await expect(plane.start({ objective: "x", target: "/tmp" })).rejects.toThrow("no loadouts registered");
  });

  test("status/report for an unknown id return undefined", async () => {
    const store = await tmpStore();
    const plane = new ControlPlane({ llm: scriptedLLM([{ text: "x", usage: zero }]), store });
    expect(plane.status("missing")).toBeUndefined();
    expect(plane.report("missing")).toBeUndefined();
  });

  test("error path: an LLM failure marks the mission status error", async () => {
    const store = await tmpStore();
    const dir = await mkdtemp(join(tmpdir(), "veritas-code-"));
    const failing = new LLMBackbone({
      configs: [cfg],
      transport: async () => {
        throw new Error("model down");
      },
      maxRetries: 0,
      sleep: async () => {},
    });
    const plane = new ControlPlane({ llm: failing, store, loadouts: loadoutsWithFs() });
    const { id, result } = await plane.start({ objective: "x", target: dir, loadout: "fs-test" });
    expect(result.status).toBe("error");
    expect(plane.status(id)).toBe("error");
  });
});
