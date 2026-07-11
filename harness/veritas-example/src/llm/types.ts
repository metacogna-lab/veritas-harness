/** Normalized LLM interface types, provider-agnostic. */
import type { ProviderConfig } from "../config/index.ts";

export type Role = "system" | "user" | "assistant" | "tool";

export interface Message {
  role: Role;
  content: string;
  /** For role:"tool" messages, the tool whose output this carries. */
  toolName?: string;
}

/** A tool schema as presented to the model (name + JSON-schema parameters). */
export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface CompletionRequest {
  system?: string;
  messages: Message[];
  tools?: ToolSchema[];
  maxTokens?: number;
  temperature?: number;
}

/** A tool call the model wants to make. */
export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface CompletionResult {
  text: string;
  toolCalls: ToolCall[];
  usage: TokenUsage;
}

/**
 * A transport performs ONE raw call to a specific provider. It knows nothing
 * about retries, fallback, or the text-mode shim — those live in LLMBackbone.
 * `nativeToolCalls` is populated only for providers used in native
 * function-calling mode; otherwise it is undefined and the shim parses tool
 * calls out of `text`.
 */
export type Transport = (
  cfg: ProviderConfig,
  req: CompletionRequest,
  signal?: AbortSignal,
) => Promise<TransportResponse>;

export interface TransportResponse {
  text: string;
  nativeToolCalls?: ToolCall[];
  usage: TokenUsage;
}
