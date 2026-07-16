/**
 * ScriptedBackbone — a deterministic, network-free LLMBackbone for tests and
 * smoke runs. It replays a fixed list of CompletionResults in order; the last
 * entry repeats once the script is exhausted. This is what lets a freshly
 * scaffolded harness pass `bun test` before any real provider key is configured.
 */
import type { ILLMBackbone, CompletionRequest, CompletionResult } from "@spine/llm/types.ts";

export class ScriptedBackbone implements ILLMBackbone {
  private index = 0;
  constructor(private readonly script: CompletionResult[]) {
    if (script.length === 0) throw new Error("ScriptedBackbone needs at least one step");
  }

  async complete(_req: CompletionRequest): Promise<CompletionResult> {
    const step = this.script[Math.min(this.index, this.script.length - 1)]!;
    this.index += 1;
    return step;
  }
}
