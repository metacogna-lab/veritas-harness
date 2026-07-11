#!/usr/bin/env bun
/**
 * Candidate harness evaluation wrapper — `bun run verify-harness-candidate`.
 *
 * Runs bench.mjs in candidate mode against a committed baseline, reads the
 * candidate-results.json, and exits non-zero on REJECT so CI or the RSI apply
 * gate can block a regressive change before it reaches the human reviewer.
 *
 * Usage:
 *   bun run verify-harness-candidate --candidate src/config/local.json --suite scope-gate
 *   bun run verify-harness-candidate --candidate candidate.json   # runs all suites
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BENCH_DIR = join(ROOT, "bench");

const args = process.argv.slice(2);
let candidatePath = null;
let suiteFilter = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--candidate" && args[i + 1]) candidatePath = args[++i];
  else if (args[i] === "--suite" && args[i + 1]) suiteFilter = args[++i];
}

if (!candidatePath) {
  console.error("verify-harness-candidate: --candidate <path> is required.");
  console.error("  example: bun run verify-harness-candidate --candidate src/config/local.json --suite scope-gate");
  process.exit(2);
}

// Delegate to bench.mjs in candidate mode.
const benchArgs = [join(ROOT, "scripts/bench.mjs")];
if (suiteFilter) benchArgs.push(suiteFilter);
benchArgs.push("--candidate", candidatePath);

const result = spawnSync("bun", benchArgs, { stdio: "inherit", cwd: ROOT });
if (result.status !== 0) {
  // bench already printed the rejection reason.
  process.exit(result.status ?? 1);
}

// Read and re-surface the candidate decision from every affected suite.
const suites = suiteFilter
  ? [suiteFilter]
  : existsSync(BENCH_DIR)
    ? (await import("node:fs")).readdirSync(BENCH_DIR).filter((n) => existsSync(join(BENCH_DIR, n, "candidate-results.json")))
    : [];

let anyReject = false;
for (const suite of suites) {
  const path = join(BENCH_DIR, suite, "candidate-results.json");
  if (!existsSync(path)) continue;
  const r = JSON.parse(readFileSync(path, "utf8"));
  if (r.decision === "reject") {
    console.error(`\nverify-harness-candidate: REJECT — suite "${suite}": ${r.rationale}`);
    anyReject = true;
  }
}

process.exit(anyReject ? 1 : 0);
