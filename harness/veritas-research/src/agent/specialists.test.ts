import { describe, expect, test } from "bun:test";
import { LoadoutRegistry } from "./specialists.ts";
import { defaultLoadouts, codebaseAuditLoadout, webReconLoadout, researchLoadout } from "./loadouts.ts";
import { Agent } from "./index.ts";
import { LLMBackbone } from "../llm/index.ts";
import type { Transport, TransportResponse } from "../llm/types.ts";
import type { ProviderConfig } from "../config/index.ts";
import { starterRegistry } from "../tools/index.ts";
import { Mission } from "../mission/index.ts";

const cfg: ProviderConfig = {
  provider: "anthropic",
  model: "fake",
  apiKey: "sk-test-000000000000",
  baseUrl: "http://localhost",
  maxTokens: 100,
  temperature: 0,
};
const zero = { inputTokens: 0, outputTokens: 0 };

function fakeLLM(resp: TransportResponse): LLMBackbone {
  const transport: Transport = async (): Promise<TransportResponse> => resp;
  return new LLMBackbone({ configs: [cfg], transport, sleep: async () => {} });
}

describe("LoadoutRegistry", () => {
  test("registers codebase-audit, web-recon, and research loadouts", () => {
    const reg = defaultLoadouts();
    expect(reg.has("codebase-audit")).toBe(true);
    expect(reg.has("web-recon")).toBe(true);
    expect(reg.has("research")).toBe(true);
    expect(reg.list()).toHaveLength(3);
  });

  test("duplicate loadout registration throws", () => {
    const reg = new LoadoutRegistry().register(codebaseAuditLoadout);
    expect(() => reg.register(codebaseAuditLoadout)).toThrow("already registered");
  });

  test("rejects a specialist allowlisting a tool the loadout does not expose", () => {
    const reg = new LoadoutRegistry();
    expect(() =>
      reg.register({
        ...codebaseAuditLoadout,
        name: "bad",
        specialists: [{ role: "x", systemPrompt: "p", toolAllowlist: ["http_get"] }],
      }),
    ).toThrow("does not expose");
  });

  test("research loadout exposes fs and web tools", () => {
    expect(researchLoadout.toolNames.sort()).toEqual(
      ["http_get", "list_dir", "read_file", "record_finding"].sort(),
    );
    expect(researchLoadout.specialists.map((s) => s.role)).toEqual(["researcher", "analyst"]);
  });

  test("target adapters build the domain's scope shape", () => {
    const fsScope = codebaseAuditLoadout.targetAdapter.buildScope("/work/project");
    expect(fsScope).toEqual({ hosts: [], paths: ["/work/project"] });
    const webScope = webReconLoadout.targetAdapter.buildScope("example.com, api.example.com");
    expect(webScope.hosts).toEqual(["example.com", "api.example.com"]);
  });
});

describe("two loadouts share one loop, differ only in tools/prompts", () => {
  test("codebase-audit specialist sees only fs tools", async () => {
    const specialist = codebaseAuditLoadout.specialists[0]!;
    const mission = new Mission({ objective: "audit", scope: { hosts: [], paths: ["/tmp"] } });
    const agent = new Agent({
      llm: fakeLLM({ text: "done", usage: zero }),
      registry: starterRegistry(),
      specialist,
      mission,
      maxSteps: 1,
    });
    const schemas = (agent as unknown as { registry: ReturnType<typeof starterRegistry> }).registry.schemas();
    expect(schemas.map((s) => s.name).sort()).toEqual(["list_dir", "read_file"]);
  });

  test("web-recon specialist sees only its allowlisted tools", async () => {
    const specialist = webReconLoadout.specialists[0]!;
    const mission = new Mission({ objective: "recon", scope: { hosts: ["example.com"], paths: [] } });
    const agent = new Agent({
      llm: fakeLLM({ text: "done", usage: zero }),
      registry: starterRegistry(),
      specialist,
      mission,
      maxSteps: 1,
    });
    const schemas = (agent as unknown as { registry: ReturnType<typeof starterRegistry> }).registry.schemas();
    expect(schemas.map((s) => s.name).sort()).toEqual(["http_get", "read_file"]);
  });

  test("the two specialists carry different prompts", () => {
    expect(codebaseAuditLoadout.specialists[0]!.systemPrompt).not.toBe(
      webReconLoadout.specialists[0]!.systemPrompt,
    );
  });
});
