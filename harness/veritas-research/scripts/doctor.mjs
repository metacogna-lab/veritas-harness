#!/usr/bin/env bun
/**
 * Environment health check — `bun run doctor`.
 *
 * Verifies the environment is sane before a mission starts:
 *   - Bun / Node version,
 *   - config loads from src/config/ and does NOT expose secrets,
 *   - active provider credentials or CLI binary reachability,
 *   - required PATH tools exist.
 */
import { loadConfig, redactedConfig, configDirectory, getProviderDef } from "../src/config/index.ts";

const checks = [];
function ok(name, detail) {
  checks.push({ level: "ok", name, detail });
}
function warn(name, detail) {
  checks.push({ level: "warn", name, detail });
}
function fail(name, detail) {
  checks.push({ level: "fail", name, detail });
}

try {
  const v = process.versions.bun;
  if (v) ok("Bun runtime", `v${v}`);
  else warn("Bun runtime", "not running under Bun");
} catch {
  warn("Bun runtime", "unknown");
}

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor >= 18) ok("Node version", `v${process.versions.node}`);
else fail("Node version", `v${process.versions.node} (need >= 18)`);

try {
  const config = loadConfig();
  const active = config.providers[0];
  ok(
    "Config loads",
    `defaultProvider=${config.defaultProvider}, active=${active?.provider}/${active?.model}, ${config.providers.length} in chain`,
  );
  ok("Config directory", configDirectory());

  const redacted = redactedConfig(config);
  const serialized = JSON.stringify(redacted);
  const leaked = config.providers.some((p) => p.apiKey && serialized.includes(p.apiKey));
  if (leaked) fail("Secret redaction", "an API key survived redaction in the serialized config");
  else ok("Secret redaction", "no secrets present in redacted config");

  const withKey = config.providers.filter((p) => p.apiKey);
  const activeDef = active ? getProviderDef(active.provider) : undefined;

  if (activeDef?.kind === "cli") {
    const found = Bun.which(activeDef.cliBinary ?? active.provider);
    if (found) ok(`CLI: ${activeDef.cliBinary}`, found);
    else warn(`CLI: ${activeDef.cliBinary}`, `not on PATH — install or set HARNESS_PROVIDER=anthropic`);
  } else if (active?.provider === "ollama") {
    warn("Provider credentials", "ollama active — no API key required; ensure Ollama is running");
  } else if (withKey.length > 0) {
    ok("Provider credentials", `${withKey.length} provider(s) have a key wired`);
  } else {
    warn(
      "Provider credentials",
      "no provider key wired — set ANTHROPIC_API_KEY (default) or HARNESS_PROVIDER=ollama",
    );
  }
} catch (err) {
  fail("Config loads", err.message);
}

for (const tool of ["git"]) {
  const found = Bun.which(tool);
  if (found) ok(`PATH: ${tool}`, found);
  else warn(`PATH: ${tool}`, "not found on PATH");
}

const icon = { ok: "✅", warn: "⚠️ ", fail: "❌" };
for (const c of checks) {
  console.log(`${icon[c.level]} ${c.name}: ${c.detail}`);
}
const failures = checks.filter((c) => c.level === "fail").length;
if (failures > 0) {
  console.error(`\ndoctor: ${failures} hard failure(s).`);
  process.exit(1);
}
console.log("\ndoctor: environment OK.");
process.exit(0);
