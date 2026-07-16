import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { redact } from "./redact.ts";
import {
  loadConfig,
  providerConfig,
  providerChain,
  isProvider,
  redactedConfig,
  normalizeProvider,
} from "./index.ts";

// Spine's own fixtures — decoupled from any single harness's committed
// src/config/*.json (configDirectory() resolves against process.cwd(), which
// is only correct when running inside a harness, not when testing the spine
// module directly from the repo root).
const FIXTURE_DEFAULT = join(import.meta.dir, "fixtures", "default.json");
const FIXTURE_LOCAL_EXAMPLE = join(import.meta.dir, "fixtures", "local.example.json");

describe("redact", () => {
  test("masks secret-named keys", () => {
    const out = redact({ apiKey: "sk-ant-abc123456789012345", user: "alex" });
    expect(out.apiKey).toBe("***REDACTED***");
    expect(out.user).toBe("alex");
  });

  test("masks nested secret-named keys", () => {
    const out = redact({
      provider: { name: "anthropic", authorization: "Bearer abcdefabcdef1234" },
      safe: { count: 3 },
    });
    expect(out.provider.authorization).toBe("***REDACTED***");
    expect(out.safe.count).toBe(3);
  });

  test("masks secret-SHAPED values even under an innocent key", () => {
    const out = redact({ note: "my key is sk-ant-abcdefghijklmnop123456" });
    expect(out.note).toBe("***REDACTED***");
  });

  test("masks a Bearer token in free text", () => {
    const out = redact({ header: "Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz012345" });
    expect(out.header).toBe("***REDACTED***");
  });

  test("masks values inside arrays of objects", () => {
    const out = redact({ providers: [{ token: "shhhhh-super-secret-value" }, { model: "gpt" }] });
    expect(out.providers[0]!.token).toBe("***REDACTED***");
    expect(out.providers[1]!.model).toBe("gpt");
  });

  test("does not mutate the input object", () => {
    const input = { apiKey: "sk-ant-abc123456789012345" };
    const out = redact(input);
    expect(input.apiKey).toBe("sk-ant-abc123456789012345");
    expect(out).not.toBe(input);
  });

  test("handles cyclic references without throwing", () => {
    const a: Record<string, unknown> = { name: "x" };
    a.self = a;
    const out = redact(a) as Record<string, unknown>;
    expect(out.name).toBe("x");
    expect(out.self).toBe("[Circular]");
  });

  test("masks a numeric value under a secret-named key", () => {
    const out = redact<Record<string, unknown>>({ password: 12345 });
    expect(out.password).toBe("***REDACTED***");
  });
});

describe("loadConfig", () => {
  test("defaults to anthropic from committed default.json", () => {
    const cfg = loadConfig({ configPath: FIXTURE_DEFAULT, env: {} });
    expect(cfg.defaultProvider).toBe("anthropic");
    expect(cfg.providers[0]!.provider).toBe("anthropic");
    expect(cfg.providers[0]!.model).toBe("claude-sonnet-5");
  });

  test("resolves api key from the provider's env var", () => {
    const cfg = loadConfig({
      configPath: FIXTURE_DEFAULT,
      env: { ANTHROPIC_API_KEY: "sk-ant-fromenv1234567890" },
    });
    expect(cfg.providers[0]!.apiKey).toBe("sk-ant-fromenv1234567890");
  });

  test("HARNESS_PROVIDER env overrides the default provider", () => {
    const cfg = loadConfig({
      configPath: FIXTURE_DEFAULT,
      env: { HARNESS_PROVIDER: "openai", OPENAI_API_KEY: "sk-openaikey1234567890" },
    });
    expect(cfg.defaultProvider).toBe("openai");
    expect(cfg.providers[0]!.provider).toBe("openai");
    expect(cfg.providers[0]!.apiKey).toBe("sk-openaikey1234567890");
  });

  test("HARNESS_MODEL env overrides model for active provider", () => {
    const cfg = loadConfig({
      configPath: FIXTURE_DEFAULT,
      env: { HARNESS_MODEL: "claude-opus-4-8" },
    });
    expect(cfg.providers[0]!.model).toBe("claude-opus-4-8");
  });

  test("HARNESS_PROVIDER=local maps to ollama", () => {
    const cfg = loadConfig({
      configPath: FIXTURE_DEFAULT,
      env: { HARNESS_PROVIDER: "local" },
    });
    expect(cfg.defaultProvider).toBe("ollama");
    expect(cfg.providers[0]!.provider).toBe("ollama");
  });

  test("loads multi-provider example config", () => {
    const cfg = loadConfig({ configPath: FIXTURE_LOCAL_EXAMPLE, env: {} });
    expect(cfg.providers.length).toBeGreaterThan(1);
    expect(cfg.providers.some((p) => p.provider === "ollama")).toBe(true);
    expect(cfg.providers.some((p) => p.provider === "claude-code")).toBe(true);
    expect(cfg.providers.some((p) => p.provider === "codex")).toBe(true);
  });

  test("does not hardcode any key when env is empty", () => {
    const cfg = loadConfig({ configPath: FIXTURE_DEFAULT, env: {} });
    expect(cfg.providers[0]!.apiKey).toBeUndefined();
  });

  test("redactedConfig masks the resolved api key", () => {
    const cfg = loadConfig({
      configPath: FIXTURE_DEFAULT,
      env: { ANTHROPIC_API_KEY: "sk-ant-fromenv1234567890" },
    });
    const safe = redactedConfig(cfg);
    expect(safe.providers[0]!.apiKey).toBe("***REDACTED***");
  });

  test("providerChain puts default provider first", () => {
    const cfg = loadConfig({ configPath: FIXTURE_LOCAL_EXAMPLE, env: {} });
    const chain = providerChain(cfg);
    expect(chain[0]!.provider).toBe(cfg.defaultProvider);
  });
});

describe("providerConfig / isProvider", () => {
  test("isProvider validates known providers and legacy local alias", () => {
    expect(isProvider("anthropic")).toBe(true);
    expect(isProvider("ollama")).toBe(true);
    expect(isProvider("local")).toBe(true);
    expect(isProvider("claude-code")).toBe(true);
    expect(isProvider("codex")).toBe(true);
    expect(isProvider("nope")).toBe(false);
  });

  test("normalizeProvider maps local to ollama", () => {
    expect(normalizeProvider("local")).toBe("ollama");
  });

  test("providerConfig returns the default provider's config", () => {
    const cfg = loadConfig({ configPath: FIXTURE_DEFAULT, env: {} });
    expect(providerConfig(cfg)?.provider).toBe("anthropic");
  });
});
