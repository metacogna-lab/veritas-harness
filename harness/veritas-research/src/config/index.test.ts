import { describe, expect, test } from "bun:test";
import { redact } from "./redact.ts";
import { loadConfig, providerConfig, isProvider, redactedConfig } from "./index.ts";

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
  test("defaults to anthropic with no env or file", () => {
    const cfg = loadConfig({ configPath: "/nonexistent/harness.json", env: {} });
    expect(cfg.defaultProvider).toBe("anthropic");
    expect(cfg.providers).toHaveLength(1);
    expect(cfg.providers[0]!.provider).toBe("anthropic");
  });

  test("resolves api key from the provider's env var", () => {
    const cfg = loadConfig({
      configPath: "/nonexistent/harness.json",
      env: { ANTHROPIC_API_KEY: "sk-ant-fromenv1234567890" },
    });
    expect(cfg.providers[0]!.apiKey).toBe("sk-ant-fromenv1234567890");
  });

  test("HARNESS_PROVIDER env overrides the default provider", () => {
    const cfg = loadConfig({
      configPath: "/nonexistent/harness.json",
      env: { HARNESS_PROVIDER: "openai", OPENAI_API_KEY: "sk-openaikey1234567890" },
    });
    expect(cfg.defaultProvider).toBe("openai");
    expect(cfg.providers[0]!.apiKey).toBe("sk-openaikey1234567890");
  });

  test("does not hardcode any key when env is empty", () => {
    const cfg = loadConfig({ configPath: "/nonexistent/harness.json", env: {} });
    expect(cfg.providers[0]!.apiKey).toBeUndefined();
  });

  test("redactedConfig masks the resolved api key", () => {
    const cfg = loadConfig({
      configPath: "/nonexistent/harness.json",
      env: { ANTHROPIC_API_KEY: "sk-ant-fromenv1234567890" },
    });
    const safe = redactedConfig(cfg);
    expect(safe.providers[0]!.apiKey).toBe("***REDACTED***");
  });
});

describe("providerConfig / isProvider", () => {
  test("isProvider validates known providers", () => {
    expect(isProvider("anthropic")).toBe(true);
    expect(isProvider("nope")).toBe(false);
  });

  test("providerConfig returns the default provider's config", () => {
    const cfg = loadConfig({ configPath: "/nonexistent/harness.json", env: {} });
    expect(providerConfig(cfg)?.provider).toBe("anthropic");
  });
});
