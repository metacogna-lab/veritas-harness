/**
 * Provider registry — defaults, env vars, transport kind, and model catalog.
 * Extend here when adding a new backend; wire the transport in `llm/transports.ts`.
 */
import type { Provider } from "./types.ts";

export type ProviderKind = "http-anthropic" | "http-openai-compatible" | "cli";

export interface ProviderDefinition {
  id: Provider;
  label: string;
  kind: ProviderKind;
  /** Env var for API key, when applicable. */
  keyEnv?: string;
  defaultBaseUrl?: string;
  defaultModel: string;
  availableModels: readonly string[];
  /** CLI binary on PATH (cli kind only). */
  cliBinary?: string;
  nativeToolCalling: boolean;
}

/** Normalize legacy alias `local` → `ollama`. */
export function normalizeProvider(value: string): Provider | undefined {
  const v = value === "local" ? "ollama" : value;
  return isProviderId(v) ? v : undefined;
}

export function isProviderId(value: string): value is Provider {
  return value in PROVIDER_REGISTRY;
}

export const PROVIDER_REGISTRY: Record<Provider, ProviderDefinition> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic API (Claude)",
    kind: "http-anthropic",
    keyEnv: "ANTHROPIC_API_KEY",
    defaultBaseUrl: "https://api.anthropic.com",
    defaultModel: "claude-sonnet-5",
    availableModels: ["claude-sonnet-5", "claude-opus-4-8", "claude-haiku-4-5-20251001"],
    nativeToolCalling: true,
  },
  "claude-code": {
    id: "claude-code",
    label: "Claude Code CLI",
    kind: "cli",
    keyEnv: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-5",
    availableModels: ["claude-sonnet-5", "claude-opus-4-8", "claude-haiku-4-5-20251001"],
    cliBinary: "claude",
    nativeToolCalling: false,
  },
  openai: {
    id: "openai",
    label: "OpenAI API",
    kind: "http-openai-compatible",
    keyEnv: "OPENAI_API_KEY",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    availableModels: ["gpt-4o", "gpt-4o-mini"],
    nativeToolCalling: true,
  },
  codex: {
    id: "codex",
    label: "OpenAI Codex CLI",
    kind: "cli",
    keyEnv: "CODEX_API_KEY",
    defaultModel: "o3",
    availableModels: ["o3", "gpt-4o"],
    cliBinary: "codex",
    nativeToolCalling: false,
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    kind: "http-openai-compatible",
    keyEnv: "OPENROUTER_API_KEY",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-sonnet-5",
    availableModels: ["anthropic/claude-sonnet-5", "meta-llama/llama-3.1-70b-instruct"],
    nativeToolCalling: true,
  },
  ollama: {
    id: "ollama",
    label: "Ollama (local)",
    kind: "http-openai-compatible",
    defaultBaseUrl: "http://127.0.0.1:11434/v1",
    defaultModel: "llama3.1",
    availableModels: ["llama3.1", "qwen2.5", "qwen3-coder:latest"],
    nativeToolCalling: false,
  },
};

export function getProviderDef(provider: Provider): ProviderDefinition {
  return PROVIDER_REGISTRY[provider];
}

export function listProviders(): ProviderDefinition[] {
  return Object.values(PROVIDER_REGISTRY);
}
