#!/usr/bin/env bun
/**
 * Benchmark harness — `bun run bench [suite]`.
 *
 * For each suite under bench/<suite>/:
 *   - loads tasks.json + committed oracle.json (ground truth, never generated
 *     at grading time),
 *   - runs the suite's solver.mjs over every task,
 *   - grades each result against the ORACLE (never a model self-report),
 *   - runs the anti-fitting guard over the solver source,
 *   - computes pass@1 + Wilson-95 SEPARATELY for black-box and white-box tasks
 *     (never blended into one number),
 *   - writes results.json, which verify-claims re-derives from.
 *
 * Grading is generic equality against the oracle — the grader does not know the
 * answers ahead of time; it reads them from the committed oracle file.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { passAtOne, wilson95, round } from "./lib/stats.mjs";
import { antiFittingGuard } from "../src/bench/guard.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BENCH_DIR = join(ROOT, "bench");
const readJSON = (p) => JSON.parse(readFileSync(p, "utf8"));

function listSuites() {
  if (!existsSync(BENCH_DIR)) return [];
  return readdirSync(BENCH_DIR).filter((name) => {
    const dir = join(BENCH_DIR, name);
    return statSync(dir).isDirectory() && existsSync(join(dir, "tasks.json")) && existsSync(join(dir, "solver.mjs"));
  });
}

function gradeMode(outcomes) {
  const passed = outcomes.filter((o) => o.pass).length;
  const n = outcomes.length;
  const ci = wilson95(passed, n);
  return { n, passed, pass_at_1: round(passAtOne(outcomes)), wilson95: { low: round(ci.low), high: round(ci.high) } };
}

async function runSuite(suite) {
  const dir = join(BENCH_DIR, suite);
  const tasks = readJSON(join(dir, "tasks.json"));
  const oracle = readJSON(join(dir, "oracle.json"));

  // Anti-fitting: the solver source must be task-agnostic.
  const solverSource = readFileSync(join(dir, "solver.mjs"), "utf8");
  antiFittingGuard({
    sources: [solverSource],
    taskIds: tasks.map((t) => t.id),
    oracleAnswers: Object.values(oracle),
  });

  const { solve } = await import(join(dir, "solver.mjs"));

  const outcomes = [];
  for (const task of tasks) {
    const expected = oracle[task.id];
    let actual;
    try {
      actual = await solve(task.input);
    } catch (err) {
      actual = `ERROR: ${err.message}`;
    }
    outcomes.push({ id: task.id, mode: task.mode ?? "black", pass: actual === expected, expected, actual });
  }

  // Report black-box and white-box SEPARATELY — never blended.
  const black = gradeMode(outcomes.filter((o) => o.mode === "black"));
  const white = gradeMode(outcomes.filter((o) => o.mode === "white"));

  const results = {
    suite,
    generatedAt: new Date().toISOString(),
    summary: { black_box: black, white_box: white },
    outcomes,
  };
  writeFileSync(join(dir, "results.json"), JSON.stringify(results, null, 2), "utf8");
  return results;
}

async function main() {
  const only = process.argv[2];
  const suites = only ? [only] : listSuites();
  if (suites.length === 0) {
    console.log("bench: no suites found under bench/. Nothing to run.");
    return 0;
  }

  let failed = 0;
  for (const suite of suites) {
    try {
      const r = await runSuite(suite);
      const b = r.summary.black_box;
      const w = r.summary.white_box;
      console.log(`\n=== ${suite} ===`);
      console.log(`  black-box: pass@1=${b.pass_at_1} (n=${b.n}, Wilson95=[${b.wilson95.low}, ${b.wilson95.high}])`);
      console.log(`  white-box: pass@1=${w.pass_at_1} (n=${w.n}, Wilson95=[${w.wilson95.low}, ${w.wilson95.high}])`);
      const failures = r.outcomes.filter((o) => !o.pass);
      if (failures.length > 0) {
        console.log(`  failing tasks: ${failures.map((f) => `${f.id}(exp=${f.expected},got=${f.actual})`).join(", ")}`);
      }
      console.log(`  wrote bench/${suite}/results.json`);
    } catch (err) {
      console.error(`\n=== ${suite} === FAILED: ${err.message}`);
      failed++;
    }
  }

  if (failed > 0) {
    console.error(`\nbench: ${failed} suite(s) failed to run.`);
    return 1;
  }
  console.log("\nbench: done. Re-run `bun run verify-claims` to confirm reported numbers reproduce.");
  return 0;
}

process.exit(await main());
