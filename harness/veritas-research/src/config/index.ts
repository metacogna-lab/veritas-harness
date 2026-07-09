/**
 * Typed configuration + provider/key resolution.
 *
 * Keys are NEVER hardcoded. They resolve from environment variables (and an
 * optional `~/.harness/config.json`), and every value that leaves this module
 * toward a log passes through `redact()`.
 */
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { redact } from "./redact.ts";

export { redact } from "./redact.ts";

export type Provider = "anthropic" | "openai" | "openrouter" | "local";

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

/** Which env var holds the API key for each provider. */
const KEY_ENV: Record<Provider, string | undefined> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  local: undefined, // local models need no key
};

/** Default base URLs; overridable via config file / env. */
const DEFAULT_BASE_URL: Record<Provider, string | undefined> = {
  anthropic: "https://api.anthropic.com",
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  local: "http://127.0.0.1:11434", // ollama default
};

/** A registry of known-good default models per provider. */
export const AVAILABLE_MODELS: Record<Provider, string[]> = {
  anthropic: ["claude-sonnet-5", "claude-opus-4-8", "claude-haiku-4-5-20251001"],
  openai: ["gpt-4o", "gpt-4o-mini"],
  openrouter: ["anthropic/claude-sonnet-5", "meta-llama/llama-3.1-70b-instruct"],
  local: ["llama3.1", "qwen2.5"],
};

const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-4o-mini",
  openrouter: "anthropic/claude-sonnet-5",
  local: "llama3.1",
};

const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.2;

interface RawConfigFile {
  defaultProvider?: Provider;
  providers?: Partial<ProviderConfig>[];
  maxTokens?: number;
  temperature?: number;
}

function readConfigFile(path: string): RawConfigFile {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return typeof parsed === "object" && parsed !== null ? (parsed as RawConfigFile) : {};
  } catch {
    return {};
  }
}

function resolveKey(
  provider: Provider,
  env: NodeJS.ProcessEnv,
  explicit?: string,
): string | undefined {
  if (explicit) return explicit;
  const envName = KEY_ENV[provider];
  return envName ? env[envName] : undefined;
}

function buildProviderConfig(
  provider: Provider,
  env: NodeJS.ProcessEnv,
  raw?: Partial<ProviderConfig>,
): ProviderConfig {
  return {
    provider,
    model: raw?.model ?? DEFAULT_MODEL[provider],
    apiKey: resolveKey(provider, env, raw?.apiKey),
    baseUrl: raw?.baseUrl ?? DEFAULT_BASE_URL[provider],
    maxTokens: raw?.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: raw?.temperature ?? DEFAULT_TEMPERATURE,
  };
}

export interface LoadConfigOptions {
  configPath?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Load harness config from env + optional `~/.harness/config.json`.
 * Env var `HARNESS_PROVIDER` overrides the default provider.
 */
export function loadConfig(opts: LoadConfigOptions = {}): HarnessConfig {
  const env = opts.env ?? process.env;
  const configPath = opts.configPath ?? join(homedir(), ".harness", "config.json");
  const file = readConfigFile(configPath);

  const envDefault = env.HARNESS_PROVIDER as Provider | undefined;
  const defaultProvider: Provider =
    (envDefault && isProvider(envDefault) ? envDefault : undefined) ??
    file.defaultProvider ??
    "anthropic";

  const declared = file.providers && file.providers.length > 0 ? file.providers : undefined;

  const providers: ProviderConfig[] = declared
    ? declared.map((p) => buildProviderConfig((p.provider ?? defaultProvider) as Provider, env, p))
    : [buildProviderConfig(defaultProvider, env)];

  return { defaultProvider, providers };
}

export function isProvider(value: string): value is Provider {
  return value === "anthropic" || value === "openai" || value === "openrouter" || value === "local";
}

/** Get the ProviderConfig for a provider, or the default provider's config. */
export function providerConfig(config: HarnessConfig, provider?: Provider): ProviderConfig | undefined {
  const target = provider ?? config.defaultProvider;
  return config.providers.find((p) => p.provider === target);
}

/** A log-safe view of the config with all secrets masked. */
export function redactedConfig(config: HarnessConfig): HarnessConfig {
  return redact(config);
}
