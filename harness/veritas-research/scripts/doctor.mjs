#!/usr/bin/env bun
/**
 * Environment health check — `bun run doctor`.
 *
 * Verifies the environment is sane before a mission starts:
 *   - Bun / Node version,
 *   - config loads and does NOT expose secrets,
 *   - at least one provider has a key wired (or local is reachable),
 *   - required PATH tools exist.
 *
 * Human-readable ✅/❌ output; non-zero exit on any hard failure. Warnings
 * (⚠️) do not fail the run.
 */
import { loadConfig, redactedConfig } from "../src/config/index.ts";

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

// Bun version
try {
  const v = process.versions.bun;
  if (v) ok("Bun runtime", `v${v}`);
  else warn("Bun runtime", "not running under Bun");
} catch {
  warn("Bun runtime", "unknown");
}

// Node version (>= 18)
const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor >= 18) ok("Node version", `v${process.versions.node}`);
else fail("Node version", `v${process.versions.node} (need >= 18)`);

// Config loads without throwing, and redaction hides secrets.
try {
  const config = loadConfig();
  ok("Config loads", `defaultProvider=${config.defaultProvider}, ${config.providers.length} provider(s)`);

  const redacted = redactedConfig(config);
  const serialized = JSON.stringify(redacted);
  const leaked = config.providers.some((p) => p.apiKey && serialized.includes(p.apiKey));
  if (leaked) fail("Secret redaction", "an API key survived redaction in the serialized config");
  else ok("Secret redaction", "no secrets present in redacted config");

  // Provider reachability: a key wired, or local provider configured.
  const withKey = config.providers.filter((p) => p.apiKey);
  const local = config.providers.find((p) => p.provider === "local");
  if (withKey.length > 0) ok("Provider credentials", `${withKey.length} provider(s) have a key wired`);
  else if (local) warn("Provider credentials", "no API keys; only local provider configured (ensure it is running)");
  else warn("Provider credentials", "no provider key wired — set e.g. ANTHROPIC_API_KEY before running a real mission");
} catch (err) {
  fail("Config loads", err.message);
}

// PATH tools
for (const tool of ["git"]) {
  const found = Bun.which(tool);
  if (found) ok(`PATH: ${tool}`, found);
  else warn(`PATH: ${tool}`, "not found on PATH");
}

// Render
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
