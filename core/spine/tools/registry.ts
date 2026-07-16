/**
 * Typed tool registry.
 *
 * Every tool declares a zod input schema, a risk tier, and — if it has side
 * effects — a `scopeTargets(input)` function that tells the scope gate what it
 * will touch. `execute()` ALWAYS: validates input against the schema, then runs
 * the injected safety check (scope in BASIC; scope+approval in INT), and only
 * then calls `run()`. A validation failure or a denied gate becomes an
 * observation string the model sees — it never throws past the loop.
 */
import { z } from "zod";
import type { ScopeTarget, ScopeCall, ScopeDecision } from "../safety/scope.ts";
import type { ToolSchema } from "../llm/types.ts";
import type { TerminalActionKind } from "../safety/human-release.ts";

/**
 * Risk tiers, ordered by escalation. `safe`/`active` are ungated; the approval
 * gate (INT 2.2) gates `intrusive`/`credential`/`dangerous`. A tool with real
 * side effects is AT LEAST `active` (enforced by the tool-adder skill).
 */
export type RiskTier = "safe" | "active" | "intrusive" | "credential" | "dangerous";

export interface Tool<I = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<I>;
  riskTier: RiskTier;
  /** Declared side-effect targets for the scope gate. Omit for inert tools. */
  scopeTargets?: (input: I) => ScopeTarget[];
  /**
   * When true, `run()` does not execute until explicit human release (invariant #5).
   * The harness stops one step short and returns a draft observation instead.
   */
  requiresHumanRelease?: boolean;
  /** Kind of terminal action for audit/release policy. Defaults to `other`. */
  terminalActionKind?: TerminalActionKind;
  run: (input: I) => Promise<string>;
}

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

/** The gate a caller injects; returns allow/deny for a resolved scope call. */
export type SafetyCheck = (call: ScopeCall, tool: Tool) => ScopeDecision | Promise<ScopeDecision>;

export interface ExecuteResult {
  ok: boolean;
  observation: string;
  /** Populated on a successful run for provenance wiring. */
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

  /** A registry containing only the named subset (for loadout tool allowlists). */
  subset(names: string[]): ToolRegistry {
    const r = new ToolRegistry();
    for (const name of names) {
      const t = this.tools.get(name);
      if (t) r.register(t);
    }
    return r;
  }

  /** Serialized schemas for the model. */
  schemas(): ToolSchema[] {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: z.toJSONSchema(t.inputSchema) as Record<string, unknown>,
    }));
  }

  /**
   * Validate a call's input and resolve its scope targets, WITHOUT running.
   * Returns either the resolved scope call or a validation error observation.
   */
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

  /**
   * Full execution path: resolve → safety check → run. Every failure mode
   * (unknown tool, invalid input, denied gate, thrown run) is returned as an
   * observation string rather than thrown.
   */
  async execute(call: ToolCall, check?: SafetyCheck): Promise<ExecuteResult> {
    const resolved = this.resolve(call);
    if (!resolved.ok) return { ok: false, observation: resolved.observation, toolName: call.name };

    if (check) {
      const decision = await check(resolved.scopeCall, resolved.tool);
      if (!decision.allowed) return { ok: false, observation: decision.reason, toolName: call.name };
    }

    try {
      const observation = await resolved.tool.run(resolved.input);
      return { ok: true, observation, toolName: call.name };
    } catch (err) {
      return { ok: false, observation: `TOOL ERROR: "${call.name}" threw: ${(err as Error).message}`, toolName: call.name };
    }
  }
}
