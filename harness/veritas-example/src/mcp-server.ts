/**
 * MCP exposure — plan 04 §5.4.
 *
 * Exposes a safe, scope-gated subset of the harness over a simple tool-call
 * surface. The MCP layer does NOT create a safety bypass: every side-effecting
 * call routes through the same ToolRegistry.execute() + composed safety check
 * as direct agent/CLI usage.
 *
 * Exposed capabilities (non-dangerous only):
 *   - list_loadouts
 *   - mission_status
 *   - execute_scoped_tool (safe/active tiers only, explicit scope required)
 */
import { z } from "zod";
import { defaultLoadouts } from "./agent/loadouts.ts";
import { starterRegistry } from "@spine/tools/index.ts";
import { createSafetyCheck } from "@spine/safety/index.ts";
import type { MissionScope } from "@spine/safety/scope.ts";
import type { MissionStore } from "@spine/control/store.ts";

const MissionScopeSchema = z.object({
  hosts: z.array(z.string()),
  paths: z.array(z.string()),
  allowLoopback: z.boolean().optional(),
  allowPrivate: z.boolean().optional(),
  allowShell: z.boolean().optional(),
});

export interface McpToolSchema {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolResult {
  ok: boolean;
  content: string;
}

const SAFE_TOOL_ALLOWLIST = new Set(["read_file", "list_dir"]);

export const MCP_TOOL_SCHEMAS: McpToolSchema[] = [
  {
    name: "list_loadouts",
    description: "List registered harness loadouts (name + description).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "mission_status",
    description: "Return status string for a mission id from the run store.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "execute_scoped_tool",
    description:
      "Execute a safe/active starter tool (read_file, list_dir) within an explicit scope. " +
      "Gated/dangerous tools and off-scope targets are rejected identically to direct calls.",
    inputSchema: {
      type: "object",
      properties: {
        tool: { type: "string", enum: ["read_file", "list_dir"] },
        input: { type: "object" },
        scope: {
          type: "object",
          properties: {
            hosts: { type: "array", items: { type: "string" } },
            paths: { type: "array", items: { type: "string" } },
          },
        },
      },
      required: ["tool", "input", "scope"],
      additionalProperties: false,
    },
  },
];

export interface McpHarnessServerOptions {
  store?: MissionStore;
}

/** Lightweight MCP tool handler — same gates as the agent loop, no bypass path. */
export class McpHarnessServer {
  private readonly store?: MissionStore;

  constructor(opts: McpHarnessServerOptions = {}) {
    this.store = opts.store;
  }

  schemas(): McpToolSchema[] {
    return MCP_TOOL_SCHEMAS;
  }

  async handleToolCall(name: string, input: Record<string, unknown>): Promise<McpToolResult> {
    switch (name) {
      case "list_loadouts":
        return this.listLoadouts();
      case "mission_status":
        return this.missionStatus(String(input.id ?? ""));
      case "execute_scoped_tool":
        return this.executeScopedTool(input);
      default:
        return { ok: false, content: `MCP ERROR: unknown tool "${name}"` };
    }
  }

  private listLoadouts(): McpToolResult {
    const lines = defaultLoadouts()
      .list()
      .map((l) => `${l.name}: ${l.description}`);
    return { ok: true, content: lines.join("\n") || "(no loadouts)" };
  }

  private missionStatus(id: string): McpToolResult {
    if (!id) return { ok: false, content: "MCP ERROR: mission_status requires id" };
    if (!this.store) return { ok: false, content: "MCP ERROR: no mission store configured" };
    const snap = this.store.load(id);
    if (!snap) return { ok: false, content: `unknown mission ${id}` };
    return { ok: true, content: snap.status };
  }

  private async executeScopedTool(input: Record<string, unknown>): Promise<McpToolResult> {
    const toolName = String(input.tool ?? "");

    if (!SAFE_TOOL_ALLOWLIST.has(toolName)) {
      return { ok: false, content: `MCP ERROR: tool "${toolName}" is not exposed via MCP (safe/active allowlist only)` };
    }

    const toolInputResult = z.record(z.string(), z.unknown()).safeParse(input.input ?? {});
    if (!toolInputResult.success) {
      return { ok: false, content: `MCP ERROR: invalid tool input: ${toolInputResult.error.message}` };
    }

    const scopeResult = MissionScopeSchema.safeParse(input.scope);
    if (!scopeResult.success) {
      return { ok: false, content: `MCP ERROR: invalid scope: ${scopeResult.error.message}` };
    }

    const scope: MissionScope = scopeResult.data;
    const registry = starterRegistry();
    const safetyCheck = createSafetyCheck({ scope });
    const result = await registry.execute({ name: toolName, input: toolInputResult.data }, safetyCheck);
    return { ok: result.ok, content: result.observation };
  }
}
