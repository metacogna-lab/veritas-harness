#!/usr/bin/env bun
/**
 * Universal harness health check — run via `bun run doctor` from any harness directory.
 * Dynamically loads src/config/index.ts from process.cwd() so it works for any harness.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { resolveSpineOrLocal } from "./lib/resolve-spine.mjs";

const root = process.cwd();
const checks = [];
const ok   = (name, detail) => checks.push({ level: "ok",   name, detail });
const warn = (name, detail) => checks.push({ level: "warn", name, detail });
const fail = (name, detail) => checks.push({ level: "fail", name, detail });

// ── Structural checks (no imports required) ────────────────────────────────
for (const p of ["package.json", "harness.json", "src/agent/index.ts"]) {
  if (existsSync(join(root, p))) ok(`present: ${p}`, root);
  else fail(`present: ${p}`, "missing");
}

// ── Runtime checks ─────────────────────────────────────────────────────────
const v = process.versions.bun;
if (v) ok("Bun runtime", `v${v}`);
else warn("Bun runtime", "not running under Bun");

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor >= 18) ok("Node version", `v${process.versions.node}`);
else fail("Node version", `v${process.versions.node} (need >= 18)`);

// ── Config checks (dynamic import, harness-specific) ───────────────────────
// Migrated harnesses import config from the canonical core/spine/ package
// (via the @spine/* alias in their own src/); doctor.mjs runs standalone, so
// it resolves the same file directly. Unmigrated harnesses (still carrying
// their own local src/config/index.ts) fall back to that copy.
const configPath = resolveSpineOrLocal(root, "config/index.ts");
if (existsSync(configPath)) {
  try {
    const { loadConfig, redactedConfig, configDirectory, getProviderDef } =
      await import(configPath);
    const config = loadConfig();
    const active = config.providers[0];
    ok("Config loads", `defaultProvider=${config.defaultProvider}, active=${active?.provider}/${active?.model}`);
    ok("Config directory", configDirectory());

    const redacted = redactedConfig(config);
    const serialized = JSON.stringify(redacted);
    const leaked = config.providers.some((p) => p.apiKey && serialized.includes(p.apiKey));
    if (leaked) fail("Secret redaction", "an API key survived redaction");
    else ok("Secret redaction", "no secrets in redacted config");

    const activeDef = active ? getProviderDef(active.provider) : undefined;
    if (activeDef?.kind === "cli") {
      const found = Bun.which(activeDef.cliBinary ?? active.provider);
      if (found) ok(`CLI: ${activeDef.cliBinary}`, found);
      else warn(`CLI: ${activeDef.cliBinary}`, "not on PATH");
    } else if (active?.provider === "ollama") {
      warn("Provider credentials", "ollama — no key required; ensure Ollama is running");
    } else {
      const withKey = config.providers.filter((p) => p.apiKey);
      if (withKey.length > 0) ok("Provider credentials", `${withKey.length} provider(s) keyed`);
      else warn("Provider credentials", "no key wired — set ANTHROPIC_API_KEY or HARNESS_PROVIDER=ollama");
    }
  } catch (err) {
    fail("Config loads", err.message);
  }
} else {
  warn("Config module", "src/config/index.ts not present — structural check only");
}

// ── PATH checks ────────────────────────────────────────────────────────────
for (const tool of ["git"]) {
  const found = Bun.which(tool);
  if (found) ok(`PATH: ${tool}`, found);
  else warn(`PATH: ${tool}`, "not found on PATH");
}

// ── Report ─────────────────────────────────────────────────────────────────
const icon = { ok: "✅", warn: "⚠️ ", fail: "❌" };
for (const c of checks) console.log(`${icon[c.level]} ${c.name}: ${c.detail}`);
const failures = checks.filter((c) => c.level === "fail").length;
if (failures > 0) { console.error(`\ndoctor: ${failures} hard failure(s).`); process.exit(1); }
else { console.log("\ndoctor: environment OK."); process.exit(0); }
