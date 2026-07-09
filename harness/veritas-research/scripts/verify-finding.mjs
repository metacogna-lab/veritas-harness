#!/usr/bin/env bun
/**
 * Run the refuter against a committed finding — `bun run verify-finding`.
 *
 * Usage:
 *   bun run verify-finding <mission.json> <findingId>
 *
 * Loads a committed mission snapshot, finds the named finding, and runs the
 * adversarial refuter (a distinct LLM instance, different temperature) against
 * it using ONLY the committed evidence. Prints CONFIRMED or RETRACTED and exits
 * non-zero on RETRACTED so it can gate a report.
 *
 * Requires a provider key at runtime (the refuter is a real model). For an
 * offline demonstration against the committed int-smoke artifact, pass
 * `--fixture`, which uses a deterministic evidence-grounded skeptic instead of
 * a network model.
 */
import { readFileSync } from "node:fs";
import { refuteFinding } from "../src/evidence/refuter.ts";
import { LLMBackbone } from "../src/llm/index.ts";
import { loadConfig, providerConfig } from "../src/config/index.ts";

const args = process.argv.slice(2);
const fixture = args.includes("--fixture");
const positional = args.filter((a) => !a.startsWith("--"));
const [snapshotPath, findingId] = positional;

if (!snapshotPath || !findingId) {
  console.error("usage: bun run verify-finding <mission.json> <findingId> [--fixture]");
  process.exit(2);
}

const snap = JSON.parse(readFileSync(snapshotPath, "utf8"));
const finding = (snap.findings ?? []).find((f) => f.id === findingId);
if (!finding) {
  console.error(`finding "${findingId}" not found in ${snapshotPath}`);
  process.exit(2);
}

function fixtureRefuter() {
  const cfg = { provider: "anthropic", model: "fixture", apiKey: "sk-x-000000000000", baseUrl: "http://localhost", maxTokens: 100, temperature: 0.9 };
  const transport = async (_c, req) => {
    const content = req.messages[0].content;
    const claim = content.split("CLAIM:\n")[1].split("\n\nEVIDENCE")[0].trim().toLowerCase();
    const evidence = content.split("EVIDENCE")[1].toLowerCase();
    const supported = evidence.includes(claim);
    return { text: JSON.stringify({ verdict: supported ? "confirmed" : "retracted", reason: supported ? "evidence supports claim" : "unsupported by evidence" }), usage: { inputTokens: 0, outputTokens: 0 } };
  };
  return new LLMBackbone({ configs: [cfg], transport, sleep: async () => {} });
}

function realRefuter() {
  const config = loadConfig();
  const primary = providerConfig(config);
  if (!primary || !primary.apiKey) {
    console.error("no provider key wired for the refuter. Set a key or use --fixture.");
    process.exit(2);
  }
  // A distinct instance with a higher temperature = an independent skeptic.
  return new LLMBackbone({ configs: [{ ...primary, temperature: 0.9 }] });
}

const refuter = fixture ? fixtureRefuter() : realRefuter();
const result = await refuteFinding(finding, snap.transcript ?? [], refuter);

console.log(`finding ${findingId}: ${result.verdict.toUpperCase()}`);
console.log(`reason: ${result.reason}`);
process.exit(result.verdict === "confirmed" ? 0 : 1);
