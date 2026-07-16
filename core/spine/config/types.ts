/** Supported LLM backends. `local` is accepted as a legacy alias for `ollama`. */
export type Provider =
  | "anthropic"
  | "claude-code"
  | "openai"
  | "codex"
  | "openrouter"
  | "ollama";

export interface ProviderConfig {
  provider: Provider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
}

export interface HarnessConfig {
  defaultProvider: Provider;
  providers: ProviderConfig[];
}

export interface RawProviderEntry {
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface RawConfigFile {
  defaultProvider?: string;
  providers?: RawProviderEntry[];
  maxTokens?: number;
  temperature?: number;
}
