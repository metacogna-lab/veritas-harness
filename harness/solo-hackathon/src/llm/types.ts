/**
 * Provider plane — the single narrow LLM interface every harness composes against.
 *
 * A real harness wires provider transports (Anthropic, local, ...), a fallback
 * chain, token accounting, and a text-mode tool shim behind `LLMBackbone`. The
 * template ships only the interface plus a deterministic scripted backbone
 * (`ScriptedBackbone`) so the spine runs and tests pass with no network. Swap in
 * a real backbone as the first extension of a new harness.
 */

export type Role = "system" | "user" | "assistant" | "tool";

export interface Message {
  role: Role;
  content: string;
  /** For role:"tool" messages, the tool whose output this carries. */
  toolName?: string;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

export interface CompletionRequest {
  system?: string;
  messages: Message[];
  tools?: ToolSchema[];
  maxTokens?: number;
  temperature?: number;
}

export interface CompletionResult {
  text: string;
  toolCalls: ToolCall[];
}

/** The one method the execution plane depends on. */
export interface LLMBackbone {
  complete(req: CompletionRequest): Promise<CompletionResult>;
}
