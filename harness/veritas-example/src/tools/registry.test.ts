import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ToolRegistry, type Tool } from "./registry.ts";
import { starterRegistry, readFileTool } from "./index.ts";
import { checkScope, type MissionScope, type ScopeCall } from "../safety/scope.ts";
import { z } from "zod";

describe("ToolRegistry basics", () => {
  test("register + get + schemas", () => {
    const r = starterRegistry();
    expect(r.has("read_file")).toBe(true);
    expect(r.get("http_get")?.riskTier).toBe("active");
    const schemas = r.schemas();
    expect(schemas.map((s) => s.name).sort()).toEqual(["http_get", "list_dir", "read_file"]);
    expect(schemas[0]!.parameters).toHaveProperty("type", "object");
  });

  test("duplicate registration throws", () => {
    const r = new ToolRegistry().register(readFileTool);
    expect(() => r.register(readFileTool)).toThrow("already registered");
  });

  test("subset yields only named tools", () => {
    const r = starterRegistry().subset(["read_file"]);
    expect(r.has("read_file")).toBe(true);
    expect(r.has("http_get")).toBe(false);
  });

  test("no starter tool exceeds the active tier (BASIC DoD)", () => {
    for (const t of starterRegistry().list()) {
      expect(["safe", "active"]).toContain(t.riskTier);
    }
  });
});

describe("ToolRegistry.execute validation", () => {
  test("unknown tool returns an observation, not a throw", async () => {
    const r = starterRegistry();
    const res = await r.execute({ name: "nope", input: {} });
    expect(res.ok).toBe(false);
    expect(res.observation).toContain("unknown tool");
  });

  test("invalid input is rejected before run", async () => {
    const r = starterRegistry();
    const res = await r.execute({ name: "read_file", input: { path: 123 } });
    expect(res.ok).toBe(false);
    expect(res.observation).toContain("invalid input");
  });

  test("a tool that throws is captured as an observation", async () => {
    const boom: Tool<{ x: string }> = {
      name: "boom",
      description: "throws",
      inputSchema: z.object({ x: z.string() }),
      riskTier: "safe",
      run: async () => {
        throw new Error("kaboom");
      },
    };
    const r = new ToolRegistry().register(boom);
    const res = await r.execute({ name: "boom", input: { x: "a" } });
    expect(res.ok).toBe(false);
    expect(res.observation).toContain("kaboom");
  });
});

describe("ToolRegistry.execute with scope gate", () => {
  const scopeCheck = (scope: MissionScope) => (call: ScopeCall) => checkScope(call, scope);

  test("happy path: read a file inside scope", async () => {
    const dir = await mkdtemp(join(tmpdir(), "veritas-"));
    const file = join(dir, "hello.txt");
    await writeFile(file, "hello world");
    const scope: MissionScope = { hosts: [], paths: [dir] };
    const r = starterRegistry();
    const res = await r.execute({ name: "read_file", input: { path: file } }, scopeCheck(scope));
    expect(res.ok).toBe(true);
    expect(res.observation).toBe("hello world");
  });

  test("scope-denied path: off-scope read returns SCOPE DENIED and never runs", async () => {
    const scope: MissionScope = { hosts: [], paths: ["/work/allowed"] };
    const r = starterRegistry();
    const res = await r.execute({ name: "read_file", input: { path: "/etc/passwd" } }, scopeCheck(scope));
    expect(res.ok).toBe(false);
    expect(res.observation).toStartWith("SCOPE DENIED:");
  });

  test("scope-denied network: off-scope http_get is blocked before fetch", async () => {
    const scope: MissionScope = { hosts: ["example.com"], paths: [] };
    const r = starterRegistry();
    const res = await r.execute({ name: "http_get", input: { url: "https://evil.test/x" } }, scopeCheck(scope));
    expect(res.ok).toBe(false);
    expect(res.observation).toStartWith("SCOPE DENIED:");
  });

  test("list_dir inside scope returns entries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "veritas-"));
    await mkdir(join(dir, "sub"));
    await writeFile(join(dir, "a.txt"), "x");
    const scope: MissionScope = { hosts: [], paths: [dir] };
    const r = starterRegistry();
    const res = await r.execute({ name: "list_dir", input: { path: dir } }, scopeCheck(scope));
    expect(res.ok).toBe(true);
    expect(res.observation).toContain("a.txt");
    expect(res.observation).toContain("sub/");
  });
});
