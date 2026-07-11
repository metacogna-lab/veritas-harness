import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { McpHarnessServer } from "./mcp-server.ts";
import { LoadoutRegistry } from "./agent/specialists.ts";
import type { Loadout } from "./agent/specialists.ts";
import { MissionStore } from "./control/store.ts";
import { Mission } from "./mission/index.ts";

describe("McpHarnessServer — no safety bypass via MCP", () => {
  test("execute_scoped_tool denies off-scope read_file (same as direct call)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "veritas-mcp-"));
    const file = join(dir, "secret.txt");
    writeFileSync(file, "secret");
    const other = mkdtempSync(join(tmpdir(), "veritas-mcp-other-"));

    const mcp = new McpHarnessServer();
    const result = await mcp.handleToolCall("execute_scoped_tool", {
      tool: "read_file",
      input: { path: file },
      scope: { hosts: [], paths: [other] },
    });

    expect(result.ok).toBe(false);
    expect(result.content).toContain("SCOPE DENIED");
  });

  test("dangerous tool name is not exposed via MCP surface", async () => {
    const mcp = new McpHarnessServer();
    const result = await mcp.handleToolCall("execute_scoped_tool", {
      tool: "http_get",
      input: { url: "https://example.com" },
      scope: { hosts: ["example.com"], paths: [] },
    });
    expect(result.ok).toBe(false);
    expect(result.content).toContain("not exposed via MCP");
  });

  test("unknown MCP tool is rejected", async () => {
    const mcp = new McpHarnessServer();
    const result = await mcp.handleToolCall("run_shell", { cmd: "rm -rf /" });
    expect(result.ok).toBe(false);
    expect(result.content).toContain("unknown tool");
  });

  test("list_loadouts returns empty when no loadouts registered", async () => {
    const mcp = new McpHarnessServer();
    const result = await mcp.handleToolCall("list_loadouts", {});
    expect(result.ok).toBe(true);
    expect(result.content).toBe("(no loadouts)");
  });

  test("list_loadouts returns injected loadouts", async () => {
    const stub: Loadout = {
      name: "stub",
      description: "stub loadout for test",
      toolNames: ["read_file"],
      specialists: [{ role: "r", systemPrompt: "p", toolAllowlist: ["read_file"] }],
      targetAdapter: { name: "fs", buildScope: (t) => ({ hosts: [], paths: [t] }), describeScope: () => "" },
    };
    const loadouts = new LoadoutRegistry().register(stub);
    const mcp = new McpHarnessServer({ loadouts });
    const result = await mcp.handleToolCall("list_loadouts", {});
    expect(result.ok).toBe(true);
    expect(result.content).toContain("stub");
  });

  test("mission_status reads from store", async () => {
    const dir = mkdtempSync(join(tmpdir(), "veritas-mcp-runs-"));
    const store = new MissionStore(dir);
    const mission = new Mission({ id: "mcp-1", objective: "test", scope: { hosts: [], paths: [] } });
    mission.setStatus("done");
    store.save(mission.snapshot());

    const mcp = new McpHarnessServer({ store });
    const result = await mcp.handleToolCall("mission_status", { id: "mcp-1" });
    expect(result.ok).toBe(true);
    expect(result.content).toBe("done");
  });
});
