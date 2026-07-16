/**
 * Feature 1 gates. Exercises the API through `app.request(...)` with injected deps —
 * no socket, no network, no DB:
 *   G1 /health · G2 read endpoints (200/404) · G3 ingest + start (scripted LLM) ·
 *   G4 SSE streams + closes on mission.end · async-without-queue guard.
 */
import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app.ts";
import { streamMissionEvents } from "./sse.ts";
import { EventBus } from "../telemetry/index.ts";
import { MissionStore } from "@spine/control/store.ts";
import { LLMBackbone } from "@spine/llm/index.ts";
import type { ProviderConfig, HarnessConfig } from "@spine/config/index.ts";
import type { TransportResponse } from "@spine/llm/types.ts";
import type { ServerDeps } from "./deps.ts";

const cfg: ProviderConfig = {
  provider: "anthropic",
  model: "fake",
  apiKey: "sk-test-000000000000",
  baseUrl: "http://localhost",
  maxTokens: 100,
  temperature: 0,
};
const config: HarnessConfig = { defaultProvider: "anthropic", providers: [cfg] };
const zero = { inputTokens: 0, outputTokens: 0 };

function scriptedLLM(responses: TransportResponse[]): LLMBackbone {
  let i = 0;
  return new LLMBackbone({ configs: [cfg], transport: async () => responses[Math.min(i++, responses.length - 1)]!, sleep: async () => {} });
}

function deps(over: Partial<ServerDeps> = {}): ServerDeps {
  const runsDir = mkdtempSync(join(tmpdir(), "veritas-srv-"));
  return {
    buildLLM: () => scriptedLLM([{ text: "done.", usage: zero }]),
    store: new MissionStore(runsDir),
    config,
    missionsDir: mkdtempSync(join(tmpdir(), "veritas-missions-")),
    ...over,
  };
}

describe("Feature 1 — API layer", () => {
  it("G1: GET /health → 200 with provider + db flag", async () => {
    const app = createApp(deps());
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; provider: string; db: boolean };
    expect(body.status).toBe("healthy");
    expect(body.provider).toBe("anthropic");
    expect(body.db).toBe(false);
  });

  it("G2: /v1/provider and /v1/loadouts return the active config", async () => {
    const app = createApp(deps());
    const prov = (await (await app.request("/v1/provider")).json()) as { provider: string };
    expect(prov.provider).toBe("anthropic");
    const loadouts = (await (await app.request("/v1/loadouts")).json()) as { loadouts: { name: string }[] };
    expect(loadouts.loadouts.map((l) => l.name)).toContain("research");
  });

  it("G2: unknown mission id → 404", async () => {
    const app = createApp(deps());
    const res = await app.request("/v1/missions/m_missing");
    expect(res.status).toBe(404);
  });

  it("G3: POST /v1/missions (ad-hoc) starts a mission and persists a snapshot", async () => {
    const d = deps({
      buildLLM: () => scriptedLLM([{ text: "app.ts exports a constant.", usage: zero }]),
    });
    const app = createApp(d);
    const res = await app.request("/v1/missions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ objective: "summarize the target dir", target: d.missionsDir, loadout: "codebase-audit" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; id: string };
    expect(body.ok).toBe(true);
    expect(body.id).toBeDefined();
    // The snapshot is readable back through the same store.
    const status = (await (await app.request(`/v1/missions/${body.id}`)).json()) as { status: string };
    expect(status.status).toBe("done");
  });

  it("G3: POST /v1/missions with neither plan nor objective+target → 400", async () => {
    const app = createApp(deps());
    const res = await app.request("/v1/missions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("async=true without a queue → 400", async () => {
    const app = createApp(deps());
    const res = await app.request("/v1/missions?async=true", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planPath: "x.json" }),
    });
    expect(res.status).toBe(400);
  });

  it("async=true WITH a queue → 202 + jobId", async () => {
    const { InMemoryJobQueue } = await import("../jobs/queue.ts");
    const app = createApp(deps({ queue: new InMemoryJobQueue() }));
    const res = await app.request("/v1/missions?async=true", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planPath: "missions/x/research-plan.json" }),
    });
    expect(res.status).toBe(202);
    expect(((await res.json()) as { jobId: string }).jobId).toBe("job_1");
  });

  it("G4: SSE stream emits mission events and closes on mission.end", async () => {
    const bus = new EventBus();
    const stream = streamMissionEvents(bus, "m_sse");
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    bus.emit({ kind: "mission.start", missionId: "m_sse", slug: "s", objective: "o" });
    bus.emit({ kind: "step.execute", missionId: "m_other", step: 1, tool: "read_file", riskTier: "safe" }); // filtered out
    bus.emit({ kind: "mission.end", missionId: "m_sse", status: "ok", durationMs: 5 });

    let text = "";
    let done = false;
    while (!done) {
      const chunk = await reader.read();
      if (chunk.value) text += decoder.decode(chunk.value);
      done = chunk.done;
    }
    expect(text).toContain("mission.start");
    expect(text).toContain("mission.end");
    expect(text).not.toContain("m_other");
  });
});
