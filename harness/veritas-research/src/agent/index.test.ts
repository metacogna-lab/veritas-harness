import { describe, expect, test, afterEach } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent } from "./index.ts";
import { LLMBackbone } from "../llm/index.ts";
import type { Transport, TransportResponse } from "../llm/types.ts";
import type { ProviderConfig } from "../config/index.ts";
import { starterRegistry } from "../tools/index.ts";
import { Mission } from "../mission/index.ts";
import type { MissionScope } from "../safety/scope.ts";

const anthropicCfg: ProviderConfig = {
  provider: "anthropic",
  model: "fake",
  apiKey: "sk-test-000000000000",
  baseUrl: "http://localhost",
  maxTokens: 100,
  temperature: 0,
};

/** A transport that replays a scripted sequence of native responses. */
function scriptedLLM(responses: TransportResponse[]): LLMBackbone {
  let i = 0;
  const transport: Transport = async (): Promise<TransportResponse> => {
    const r = responses[Math.min(i, responses.length - 1)]!;
    i++;
    return r;
  };
  return new LLMBackbone({ configs: [anthropicCfg], transport, sleep: async () => {} });
}

const zero = { inputTokens: 0, outputTokens: 0 };
const SYSTEM = "You are a research agent. Use tools then answer.";

describe("Agent scripted run", () => {
  test("drives a 3-step run: read_file -> list_dir -> final answer", async () => {
    const dir = await mkdtemp(join(tmpdir(), "veritas-agent-"));
    const file = join(dir, "note.txt");
    await writeFile(file, "hello from the file");
    const scope: MissionScope = { hosts: [], paths: [dir] };
    const mission = new Mission({ objective: "read the file and summarize it", scope });

    const llm = scriptedLLM([
      { text: "", nativeToolCalls: [{ name: "read_file", input: { path: file } }], usage: zero },
      { text: "", nativeToolCalls: [{ name: "list_dir", input: { path: dir } }], usage: zero },
      { text: "Summary: the file greets the reader.", usage: zero },
    ]);

    const events: string[] = [];
    const agent = new Agent({ llm, registry: starterRegistry(), systemPrompt: SYSTEM, mission, maxSteps: 5 });
    agent.on("toolCall", (i) => events.push(`toolCall:${i.name}`));
    agent.on("observation", (i) => events.push(`obs:${i.ok}`));
    agent.on("done", (r) => events.push(`done:${r.status}`));

    const result = await agent.run();

    expect(result.status).toBe("answered");
    expect(result.answer).toContain("Summary");
    expect(result.steps).toBe(3);
    expect(events).toEqual(["toolCall:read_file", "obs:true", "toolCall:list_dir", "obs:true", "done:answered"]);

    // Full transcript is recoverable from the Mission afterward.
    const snap = mission.snapshot();
    const kinds = snap.transcript.map((e) => e.kind);
    expect(kinds).toContain("observation");
    const readObs = snap.transcript.find((e) => e.kind === "observation");
    expect(readObs!.content).toBe("hello from the file");
    expect(snap.status).toBe("done");
  });

  test("stops at the hard maxSteps ceiling when the model never answers", async () => {
    const dir = await mkdtemp(join(tmpdir(), "veritas-agent-"));
    const file = join(dir, "a.txt");
    await writeFile(file, "x");
    const scope: MissionScope = { hosts: [], paths: [dir] };
    const mission = new Mission({ objective: "loop forever", scope });
    // Always asks for a tool, never gives a final answer.
    const llm = scriptedLLM([
      { text: "", nativeToolCalls: [{ name: "read_file", input: { path: file } }], usage: zero },
    ]);
    const agent = new Agent({ llm, registry: starterRegistry(), systemPrompt: SYSTEM, mission, maxSteps: 3 });
    const result = await agent.run();
    expect(result.status).toBe("max_steps");
    expect(result.steps).toBe(3);
  });
});

describe("Agent scope-denial end-to-end (BASIC DoD)", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("an off-scope http_get is denied with SCOPE DENIED and no network call occurs", async () => {
    let fetchCalled = false;
    // If the gate ever lets the tool run, this spy records the network attempt.
    globalThis.fetch = (async () => {
      fetchCalled = true;
      throw new Error("network should never be reached");
    }) as unknown as typeof fetch;

    const scope: MissionScope = { hosts: ["example.com"], paths: [] };
    const mission = new Mission({ objective: "fetch an off-scope host", scope });
    const llm = scriptedLLM([
      { text: "", nativeToolCalls: [{ name: "http_get", input: { url: "https://evil.test/secret" } }], usage: zero },
      { text: "I could not access that host; it is out of scope.", usage: zero },
    ]);

    const observations: { ok: boolean; observation: string }[] = [];
    const agent = new Agent({ llm, registry: starterRegistry(), systemPrompt: SYSTEM, mission, maxSteps: 3 });
    agent.on("observation", (i) => observations.push({ ok: i.ok, observation: i.observation }));

    const result = await agent.run();

    expect(fetchCalled).toBe(false); // the gate blocked before any network call
    expect(observations).toHaveLength(1);
    expect(observations[0]!.ok).toBe(false);
    expect(observations[0]!.observation).toStartWith("SCOPE DENIED:");
    expect(result.status).toBe("answered");

    // The denial is durably recorded in the append-only transcript.
    const denial = mission.snapshot().transcript.find((e) => e.kind === "observation");
    expect(denial!.content).toStartWith("SCOPE DENIED:");
  });
});
