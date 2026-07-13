import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ControlPlane } from "./plane.ts";
import { MissionStore } from "./store.ts";
import { LLMBackbone } from "../llm/index.ts";
import type { Transport, TransportResponse } from "../llm/types.ts";
import type { ProviderConfig } from "../config/index.ts";
import { loadResearchPlan } from "../resources/research-plan.ts";
import { EventBus } from "../telemetry/index.ts";
import type { HarnessEvent } from "../telemetry/types.ts";

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
    const plane = new ControlPlane({ llm, store });

    const events: string[] = [];
    const { id, result } = await plane.start({
      objective: "summarize app.ts",
      target: dir,
      loadout: "codebase-audit",
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
    const plane = new ControlPlane({ llm, store });
    const { id } = await plane.start({ objective: "read secrets", target: dir, loadout: "codebase-audit" });
    const snap = store.load(id)!;
    const obs = snap.transcript.find((e) => e.kind === "observation")!;
    expect(obs.content).toStartWith("SCOPE DENIED:");
  });

  test("unknown loadout throws with the available list", async () => {
    const store = await tmpStore();
    const plane = new ControlPlane({ llm: scriptedLLM([{ text: "x", usage: zero }]), store });
    await expect(plane.start({ objective: "x", target: "/tmp", loadout: "nope" })).rejects.toThrow("unknown loadout");
  });

  test("status/report for an unknown id return undefined", async () => {
    const store = await tmpStore();
    const plane = new ControlPlane({ llm: scriptedLLM([{ text: "x", usage: zero }]), store });
    expect(plane.status("missing")).toBeUndefined();
    expect(plane.report("missing")).toBeUndefined();
  });

  test("start with research plan uses plan objective and records plan note", async () => {
    const store = await tmpStore();
    const planPath = join(import.meta.dir, "../../missions/example-slug/research-plan.json");
    const plan = loadResearchPlan(planPath);
    const llm = scriptedLLM([{ text: "Research complete per plan.", usage: zero }]);
    const plane = new ControlPlane({ llm, store });
    // The plan is authoritative (v0.2 M-1); target/objective come from the plan,
    // not from conflicting explicit fields. Skip gates for this minimal fixture.
    const { id } = await plane.start({ plan, skipPlanEval: true, skipDigest: true });
    const snap = store.load(id)!;
    expect(snap.objective).toBe(plan.objective);
    expect(snap.scope.paths).toContain("bench/scope-gate");
    const note = snap.transcript.find((e) => e.kind === "note");
    expect(note?.content).toContain("example-slug");
  });

  test("emits mission.start and mission.end on the telemetry bus (W4)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "veritas-code-"));
    const file = join(dir, "app.ts");
    await writeFile(file, "export const x = 1;");
    const store = await tmpStore();
    const bus = new EventBus();
    const events: HarnessEvent[] = [];
    bus.on((e) => events.push(e));

    const llm = scriptedLLM([{ text: "done, x is a constant.", usage: zero }]);
    const plane = new ControlPlane({ llm, store, bus });
    await plane.start({ objective: "summarize app.ts", target: dir, loadout: "codebase-audit" });

    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain("mission.start");
    expect(kinds).toContain("mission.end");
    const end = events.find((e) => e.kind === "mission.end");
    expect(end && end.kind === "mission.end" && end.status).toBe("ok");
  });

  test("emits nothing and behaves identically when no bus is wired (W4 zero-cost)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "veritas-code-"));
    await writeFile(join(dir, "app.ts"), "export const x = 1;");
    const store = await tmpStore();
    const llm = scriptedLLM([{ text: "done.", usage: zero }]);
    const plane = new ControlPlane({ llm, store }); // no bus
    const { result } = await plane.start({ objective: "summarize app.ts", target: dir, loadout: "codebase-audit" });
    expect(result.status).toBe("answered");
  });

  test("start rejects an explicit objective that contradicts the plan (M-1)", async () => {
    const store = await tmpStore();
    const planPath = join(import.meta.dir, "../../missions/example-slug/research-plan.json");
    const plan = loadResearchPlan(planPath);
    const plane = new ControlPlane({ llm: scriptedLLM([{ text: "x", usage: zero }]), store });
    await expect(
      plane.start({ plan, objective: "a totally different objective", skipPlanEval: true, skipDigest: true }),
    ).rejects.toThrow("contradict");
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
    const plane = new ControlPlane({ llm: failing, store });
    const { id, result } = await plane.start({ objective: "x", target: dir, loadout: "codebase-audit" });
    expect(result.status).toBe("error");
    expect(plane.status(id)).toBe("error");
  });
});
