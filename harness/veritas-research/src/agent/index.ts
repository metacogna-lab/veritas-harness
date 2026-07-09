/**
 * The ReAct agent loop.
 *
 * One agent, one loop: system prompt → ask model for next action → if it is a
 * tool call, run it THROUGH the safety gate → feed the observation back → repeat
 * → stop on a final answer or when maxSteps is hit.
 *
 * Design invariants:
 *   - `maxSteps` is a HARD ceiling with no override path.
 *   - Every model turn and every tool observation is written to the Mission's
 *     append-only log — the mission transcript is the single source of truth the
 *     next step is built from.
 *   - Tool calls are gated by an injected `safetyCheck`. In BASIC this is
 *     scope-only; INT swaps in the composed scope+approval check WITHOUT
 *     changing this loop (invariant #8: compose, don't fork).
 */
import { EventEmitter } from "eventemitter3";
import type { LLMBackbone } from "../llm/index.ts";
import type { CompletionRequest, Message } from "../llm/types.ts";
import type { ToolRegistry, SafetyCheck } from "../tools/registry.ts";
import type { Mission } from "../mission/index.ts";
import { checkScope } from "../safety/scope.ts";
import type { Specialist } from "./specialists.ts";

export * from "./specialists.ts";
export * from "./loadouts.ts";

export type AgentStopReason = "answered" | "max_steps" | "error";

export interface AgentResult {
  status: AgentStopReason;
  answer?: string;
  steps: number;
  error?: string;
}

export interface AgentEvents {
  step: (info: { step: number }) => void;
  toolCall: (info: { step: number; name: string; input: Record<string, unknown> }) => void;
  observation: (info: { step: number; name: string; ok: boolean; observation: string }) => void;
  done: (result: AgentResult) => void;
  error: (info: { step: number; error: string }) => void;
}

export interface AgentOptions {
  llm: LLMBackbone;
  registry: ToolRegistry;
  /** System prompt. Optional if `specialist` is given (its prompt is used). */
  systemPrompt?: string;
  mission: Mission;
  maxSteps: number;
  /** Gate for every tool call. Default: scope-only (BASIC). */
  safetyCheck?: SafetyCheck;
  /**
   * A role-scoped specialist. When present, its systemPrompt is used and the
   * registry is constrained to its tool allowlist. The LOOP is unchanged — the
   * specialist only parameterizes construction (invariant #8: compose, don't
   * fork).
   */
  specialist?: Specialist;
}

export class Agent extends EventEmitter<AgentEvents> {
  private readonly llm: LLMBackbone;
  private readonly registry: ToolRegistry;
  private readonly systemPrompt: string;
  readonly mission: Mission;
  private readonly maxSteps: number;
  private readonly safetyCheck: SafetyCheck;

  constructor(opts: AgentOptions) {
    super();
    if (opts.maxSteps < 1) throw new Error("maxSteps must be >= 1");
    const systemPrompt = opts.systemPrompt ?? opts.specialist?.systemPrompt;
    if (!systemPrompt) throw new Error("Agent requires a systemPrompt or a specialist");
    this.llm = opts.llm;
    this.registry = opts.specialist ? opts.registry.subset(opts.specialist.toolAllowlist) : opts.registry;
    this.systemPrompt = systemPrompt;
    this.mission = opts.mission;
    this.maxSteps = opts.maxSteps;
    this.safetyCheck = opts.safetyCheck ?? ((call) => checkScope(call, this.mission.scope));
  }

  async run(signal?: AbortSignal): Promise<AgentResult> {
    this.mission.setStatus("running");
    try {
      for (let step = 1; step <= this.maxSteps; step++) {
        this.emit("step", { step });
        const completion = await this.llm.complete(this.buildRequest(), signal);
        this.mission.record("model", completion.text || "(tool call)");

        if (completion.toolCalls.length === 0) {
          const answer = completion.text.trim();
          this.mission.record("note", "final answer produced");
          this.mission.setStatus("done");
          const result: AgentResult = { status: "answered", answer, steps: step };
          this.emit("done", result);
          return result;
        }

        // BASIC executes one tool per step (the first proposed call).
        const call = completion.toolCalls[0]!;
        this.mission.record("tool_call", call.name, { input: call.input });
        this.emit("toolCall", { step, name: call.name, input: call.input });

        const exec = await this.registry.execute(call, this.safetyCheck);
        this.mission.record("observation", exec.observation, { tool: call.name, ok: exec.ok });
        this.emit("observation", { step, name: call.name, ok: exec.ok, observation: exec.observation });
      }

      this.mission.record("note", "max steps reached");
      this.mission.setStatus("done");
      const result: AgentResult = { status: "max_steps", steps: this.maxSteps };
      this.emit("done", result);
      return result;
    } catch (err) {
      const message = (err as Error).message;
      this.mission.record("note", `agent error: ${message}`);
      this.mission.setStatus("error");
      this.emit("error", { step: -1, error: message });
      const result: AgentResult = { status: "error", steps: 0, error: message };
      this.emit("done", result);
      return result;
    }
  }

  private buildRequest(): CompletionRequest {
    const messages: Message[] = [
      {
        role: "user",
        content:
          `Objective: ${this.mission.objective}\n\n` +
          `Transcript so far:\n${this.mission.transcript()}\n\n` +
          `Decide your next action. Use a tool if you need more information, ` +
          `otherwise give your final answer.`,
      },
    ];
    return {
      system: this.systemPrompt,
      messages,
      tools: this.registry.schemas(),
    };
  }
}
