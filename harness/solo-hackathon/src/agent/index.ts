/**
 * Execution plane — the ReAct loop. Deliberately "dumb": it proposes an action,
 * routes EVERY tool call through the injected safety check, records the
 * observation on the mission ledger, and repeats under a hard step ceiling.
 * Model judgment lives in the prompt and the backbone — never in this loop
 * (invariant #8: compose, don't fork this file to add a capability).
 */
import type { LLMBackbone, Message } from "../llm/types.ts";
import { ToolRegistry, type SafetyCheck } from "../tools/registry.ts";
import { Mission } from "../mission/index.ts";
import { checkScope, type MissionScope, type ScopeCall } from "../safety/scope.ts";
import { parseLastObject } from "../parse/json.ts";

export interface AgentDeps {
  llm: LLMBackbone;
  registry: ToolRegistry;
  mission: Mission;
  system: string;
  safetyCheck: SafetyCheck;
  maxSteps?: number;
}

export interface AgentResult {
  answer: string;
  steps: number;
  stopped: boolean;
}

/** Default gate: scope-only, checked against the mission's declared scope. */
export const scopeOnlyCheck =
  (scope: MissionScope): SafetyCheck =>
  (call: ScopeCall) =>
    checkScope(call, scope);

export async function runAgent(deps: AgentDeps): Promise<AgentResult> {
  const maxSteps = deps.maxSteps ?? 8;
  const messages: Message[] = [{ role: "user", content: deps.mission.objective }];

  for (let step = 0; step < maxSteps; step++) {
    const res = await deps.llm.complete({
      system: deps.system,
      messages,
      tools: deps.registry.schemas(),
    });

    if (res.toolCalls.length > 0) {
      const call = res.toolCalls[0]!;
      const exec = await deps.registry.execute(call, deps.safetyCheck);
      deps.mission.record({
        toolName: call.name,
        input: call.input,
        observation: exec.observation,
        ok: exec.ok,
        at: new Date().toISOString(),
      });
      messages.push({ role: "assistant", content: res.text });
      messages.push({ role: "tool", toolName: call.name, content: exec.observation });
      continue;
    }

    const obj = parseLastObject(res.text);
    if (obj && obj.action === "final") {
      return { answer: String(obj.answer ?? ""), steps: step + 1, stopped: false };
    }
    return { answer: res.text, steps: step + 1, stopped: false };
  }

  return { answer: "STOPPED: max steps reached", steps: maxSteps, stopped: true };
}
