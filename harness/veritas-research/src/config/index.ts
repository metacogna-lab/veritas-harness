/**
 * Typed configuration + provider/key resolution.
 *
 * Config files live in this directory (`default.json` committed, `local.json`
 * optional and gitignored). Keys resolve from environment variables; every
 * value that leaves this module toward a log passes through `redact()`.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { redact } from "./redact.ts";
import { getProviderDef, isProviderId, normalizeProvider } from "./providers.ts";
import type { HarnessConfig, Provider, ProviderConfig, RawConfigFile } from "./types.ts";

export { redact } from "./redact.ts";
export type { Provider, ProviderConfig, HarnessConfig } from "./types.ts";
export {
  PROVIDER_REGISTRY,
  getProviderDef,
  listProviders,
  normalizeProvider,
  isProviderId,
} from "./providers.ts";
export type { ProviderDefinition, ProviderKind } from "./providers.ts";

const CONFIG_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.2;

/** @deprecated Use `isProviderId` — kept for existing call sites. */
export function isProvider(value: string): value is Provider {
  return isProviderId(value) || normalizeProvider(value) !== undefined;
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

function mergeRaw(base: RawConfigFile, overlay: RawConfigFile): RawConfigFile {
  return {
    defaultProvider: overlay.defaultProvider ?? base.defaultProvider,
    maxTokens: overlay.maxTokens ?? base.maxTokens,
    temperature: overlay.temperature ?? base.temperature,
    providers: overlay.providers ?? base.providers,
  };
}

function resolveKey(provider: Provider, env: NodeJS.ProcessEnv, explicit?: string): string | undefined {
  if (explicit) return explicit;
  const envName = getProviderDef(provider).keyEnv;
  return envName ? env[envName] : undefined;
}

function buildProviderConfig(
  provider: Provider,
  env: NodeJS.ProcessEnv,
  raw?: RawConfigFile["providers"] extends (infer T)[] | undefined ? T : never,
  fileDefaults?: Pick<RawConfigFile, "maxTokens" | "temperature">,
): ProviderConfig {
  const def = getProviderDef(provider);
  return {
    provider,
    model: raw?.model ?? def.defaultModel,
    apiKey: resolveKey(provider, env, raw?.apiKey),
    baseUrl: raw?.baseUrl ?? def.defaultBaseUrl,
    maxTokens: raw?.maxTokens ?? fileDefaults?.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: raw?.temperature ?? fileDefaults?.temperature ?? DEFAULT_TEMPERATURE,
  };
}

function buildProvidersFromRaw(raw: RawConfigFile, env: NodeJS.ProcessEnv): ProviderConfig[] {
  const defaultProvider =
    normalizeProvider(raw.defaultProvider ?? "anthropic") ?? "anthropic";
  const fileDefaults = { maxTokens: raw.maxTokens, temperature: raw.temperature };

  if (raw.providers && raw.providers.length > 0) {
    return raw.providers.map((entry) => {
      const provider = normalizeProvider(entry.provider ?? defaultProvider);
      if (!provider) throw new Error(`unknown provider in config: ${entry.provider}`);
      return buildProviderConfig(provider, env, entry, fileDefaults);
    });
  }

  return [buildProviderConfig(defaultProvider, env, undefined, fileDefaults)];
}

function orderProviders(config: HarnessConfig): ProviderConfig[] {
  const primary = providerConfig(config);
  const rest = config.providers.filter((p) => p.provider !== config.defaultProvider);
  return primary ? [primary, ...rest] : config.providers;
}

function applyEnvOverrides(config: HarnessConfig, env: NodeJS.ProcessEnv): HarnessConfig {
  let defaultProvider = config.defaultProvider;
  let providers = [...config.providers];

  const envProvider = env.HARNESS_PROVIDER ? normalizeProvider(env.HARNESS_PROVIDER) : undefined;
  if (envProvider) {
    defaultProvider = envProvider;
    const existing = providers.find((p) => p.provider === envProvider);
    if (existing) {
      providers = [existing, ...providers.filter((p) => p.provider !== envProvider)];
    } else {
      providers = [buildProviderConfig(envProvider, env), ...providers];
    }
  }

  const envModel = env.HARNESS_MODEL?.trim();
  if (envModel) {
    providers = providers.map((p) =>
      p.provider === defaultProvider ? { ...p, model: envModel } : p,
    );
    if (!providers.some((p) => p.provider === defaultProvider)) {
      providers = [{ ...buildProviderConfig(defaultProvider, env), model: envModel }, ...providers];
    }
  }

  return { defaultProvider, providers: orderProviders({ defaultProvider, providers }) };
}

export interface LoadConfigOptions {
  /** Override config file path (replaces default + local merge). */
  configPath?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Load harness config from `src/config/default.json`, optional `local.json`,
 * and env overrides (`HARNESS_PROVIDER`, `HARNESS_MODEL`, `HARNESS_CONFIG`).
 */
export function loadConfig(opts: LoadConfigOptions = {}): HarnessConfig {
  const env = opts.env ?? process.env;
  let raw: RawConfigFile;

  if (opts.configPath) {
    raw = readConfigFile(opts.configPath);
  } else if (env.HARNESS_CONFIG) {
    raw = readConfigFile(env.HARNESS_CONFIG);
  } else {
    const base = readConfigFile(join(CONFIG_DIR, "default.json"));
    const local = readConfigFile(join(CONFIG_DIR, "local.json"));
    raw = mergeRaw(base, local);
  }

  const defaultProvider = normalizeProvider(raw.defaultProvider ?? "anthropic") ?? "anthropic";
  const providers = buildProvidersFromRaw({ ...raw, defaultProvider }, env);
  return applyEnvOverrides({ defaultProvider, providers }, env);
}

/** Get the ProviderConfig for a provider, or the default provider's config. */
export function providerConfig(config: HarnessConfig, provider?: Provider): ProviderConfig | undefined {
  const target = provider ?? config.defaultProvider;
  return config.providers.find((p) => p.provider === target);
}

/** Ordered provider chain for LLMBackbone fallback (primary first). */
export function providerChain(config: HarnessConfig): ProviderConfig[] {
  return orderProviders(config);
}

/** A log-safe view of the config with all secrets masked. */
export function redactedConfig(config: HarnessConfig): HarnessConfig {
  return redact(config);
}

/** Absolute path to the config directory (for docs/doctor). */
export function configDirectory(): string {
  return CONFIG_DIR;
}
