/**
 * Capability plane — typed tool registry.
 *
 * Every tool declares a zod input schema, a risk tier, and — if it has side
 * effects — a `scopeTargets(input)` for the safety gate. `execute()` ALWAYS:
 * validates input, runs the injected safety check, then calls `run()`. Every
 * failure mode is returned as an observation string, never thrown past the loop.
 */
import { z } from "zod";
import type { ScopeTarget, ScopeCall, ScopeDecision } from "../safety/scope.ts";
import type { ToolSchema } from "../llm/types.ts";

/** A tool with real side effects is AT LEAST `active`. Gated tiers require approval (add an approval gate to extend). */
export type RiskTier = "safe" | "active" | "intrusive" | "credential" | "dangerous";

export interface Tool<I = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<I>;
  riskTier: RiskTier;
  scopeTargets?: (input: I) => ScopeTarget[];
  /** When true, run() stops one step short and requires explicit human release (invariant #5). */
  requiresHumanRelease?: boolean;
  run: (input: I) => Promise<string>;
}

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

export type SafetyCheck = (call: ScopeCall, tool: Tool) => ScopeDecision | Promise<ScopeDecision>;

export interface ExecuteResult {
  ok: boolean;
  observation: string;
  toolName: string;
}

export class ToolRegistry {
  private readonly tools = new Map<string, Tool<any>>();

  register<I>(tool: Tool<I>): this {
    if (this.tools.has(tool.name)) throw new Error(`tool "${tool.name}" already registered`);
    this.tools.set(tool.name, tool as Tool<any>);
    return this;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  get(name: string): Tool<any> | undefined {
    return this.tools.get(name);
  }

  list(): Tool<any>[] {
    return [...this.tools.values()];
  }

  schemas(): ToolSchema[] {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: z.toJSONSchema(t.inputSchema) as Record<string, unknown>,
    }));
  }

  resolve(
    call: ToolCall,
  ): { ok: true; tool: Tool<any>; input: unknown; scopeCall: ScopeCall } | { ok: false; observation: string } {
    const tool = this.tools.get(call.name);
    if (!tool) return { ok: false, observation: `TOOL ERROR: unknown tool "${call.name}"` };
    const parsed = tool.inputSchema.safeParse(call.input);
    if (!parsed.success) {
      return { ok: false, observation: `TOOL ERROR: invalid input for "${call.name}": ${parsed.error.message}` };
    }
    const targets = tool.scopeTargets ? tool.scopeTargets(parsed.data) : [];
    return { ok: true, tool, input: parsed.data, scopeCall: { toolName: call.name, targets } };
  }

  async execute(call: ToolCall, check?: SafetyCheck): Promise<ExecuteResult> {
    const resolved = this.resolve(call);
    if (!resolved.ok) return { ok: false, observation: resolved.observation, toolName: call.name };

    if (check) {
      const decision = await check(resolved.scopeCall, resolved.tool);
      if (!decision.allowed) return { ok: false, observation: decision.reason, toolName: call.name };
    }

    if (resolved.tool.requiresHumanRelease) {
      return {
        ok: false,
        observation: `HUMAN RELEASE REQUIRED: "${call.name}" is a terminal action; a human must execute it.`,
        toolName: call.name,
      };
    }

    try {
      const observation = await resolved.tool.run(resolved.input);
      return { ok: true, observation, toolName: call.name };
    } catch (err) {
      return { ok: false, observation: `TOOL ERROR: "${call.name}" threw: ${(err as Error).message}`, toolName: call.name };
    }
  }
}
