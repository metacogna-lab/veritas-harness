#!/usr/bin/env bun
/**
 * Reproducibility guard — invariant #6: reproduce before report.
 *
 * Re-derives every headline number the harness reports from COMMITTED artifacts.
 * It never trusts a cached number: each claim in `claims.json` states a value,
 * and this script recomputes that value from the referenced committed files. A
 * mismatch, a missing artifact, or an unknown claim kind exits non-zero.
 *
 * Wired as `bun run verify-claims` and a git pre-push hook, so a claim that
 * can't be reproduced does not ship.
 *
 * claims.json (repo root) is an array of:
 *   { "id", "statement", "kind", "args", "value" }
 * Supported kinds:
 *   - "findings_count"  args: { snapshot, status } -> count findings of a status
 *   - "bench_pass_at_1" args: { suite, mode }      -> recompute pass@1 from results
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { passAtOne, round } from "../../base-scripts/lib/stats.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function readJSON(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function deriveFindingsCount(args) {
  const snapPath = join(ROOT, args.snapshot);
  if (!existsSync(snapPath)) throw new Error(`snapshot not found: ${args.snapshot}`);
  const snap = readJSON(snapPath);
  const findings = Array.isArray(snap.findings) ? snap.findings : [];
  return findings.filter((f) => f.status === args.status).length;
}

function deriveBenchPassAtOne(args) {
  const resultsPath = join(ROOT, "bench", args.suite, "results.json");
  if (!existsSync(resultsPath)) throw new Error(`bench results not found: bench/${args.suite}/results.json`);
  const results = readJSON(resultsPath);
  const mode = args.mode ?? "black";
  const outcomes = (results.outcomes ?? []).filter((o) => o.mode === mode);
  return round(passAtOne(outcomes));
}

function derive(claim) {
  switch (claim.kind) {
    case "findings_count":
      return deriveFindingsCount(claim.args);
    case "bench_pass_at_1":
      return deriveBenchPassAtOne(claim.args);
    default:
      throw new Error(`unknown claim kind "${claim.kind}"`);
  }
}

function main() {
  const claimsPath = join(ROOT, "claims.json");
  if (!existsSync(claimsPath)) {
    console.log("verify-claims: no claims.json present — nothing to verify. ✅");
    return 0;
  }
  const claims = readJSON(claimsPath);
  if (!Array.isArray(claims) || claims.length === 0) {
    console.log("verify-claims: claims.json is empty — nothing to verify. ✅");
    return 0;
  }

  let failures = 0;
  for (const claim of claims) {
    try {
      const derived = derive(claim);
      const expected = claim.value;
      const ok = derived === expected;
      const mark = ok ? "✅" : "❌";
      console.log(`${mark} [${claim.id}] ${claim.statement}`);
      console.log(`    stated=${JSON.stringify(expected)} derived=${JSON.stringify(derived)}`);
      if (!ok) failures++;
    } catch (err) {
      console.log(`❌ [${claim.id}] ${claim.statement}`);
      console.log(`    could not reproduce: ${err.message}`);
      failures++;
    }
  }

  if (failures > 0) {
    console.error(`\nverify-claims: ${failures} claim(s) could not be reproduced. A claim that can't be reproduced doesn't ship.`);
    return 1;
  }
  console.log(`\nverify-claims: all ${claims.length} claim(s) reproduced from committed artifacts. ✅`);
  return 0;
}

process.exit(main());
