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
import { passAtOne, wilson95, round } from "../../../base-scripts/lib/stats.mjs";
import { antiFittingGuard } from "../src/bench/guard.ts";

// ── candidate decision logic ──────────────────────────────────────────────────

const REJECT_THRESHOLD = 0.05; // drop > 5pp on any metric → reject

/**
 * Compare candidate pass@1 scores to baseline and emit a promotion decision.
 * - promote: candidate ≥ baseline on BOTH black-box AND white-box
 * - reject:  candidate drops > REJECT_THRESHOLD on any metric
 * - hold:    mild regression (≤ threshold) — not enough to auto-reject
 */
function decideCandidatePromotion(candidate, baseline) {
  const blackDrop = baseline.black_box - candidate.black_box;
  const whiteDrop = baseline.white_box - candidate.white_box;

  if (blackDrop > REJECT_THRESHOLD || whiteDrop > REJECT_THRESHOLD) {
    return {
      decision: "reject",
      rationale:
        `black-box drop ${round(blackDrop * 100)}pp, white-box drop ${round(whiteDrop * 100)}pp ` +
        `(threshold: ${REJECT_THRESHOLD * 100}pp)`,
    };
  }
  if (blackDrop > 0 || whiteDrop > 0) {
    return {
      decision: "hold",
      rationale: `mild regression — black-box Δ${round(-blackDrop * 100)}pp, white-box Δ${round(-whiteDrop * 100)}pp. Human review recommended.`,
    };
  }
  return {
    decision: "promote",
    rationale: `no regression — black-box ${round(candidate.black_box * 100)}%, white-box ${round(candidate.white_box * 100)}%`,
  };
}

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

/**
 * Run a suite in candidate mode: compare fresh run against committed baseline.
 * Writes bench/<suite>/candidate-results.json (gitignored) and returns the decision.
 */
async function runSuiteCandidate(suite, candidatePath) {
  const dir = join(BENCH_DIR, suite);
  const baselinePath = join(dir, "results.json");
  if (!existsSync(baselinePath)) {
    throw new Error(`No committed baseline results.json for suite "${suite}". Run bun run bench first.`);
  }
  const baseline = readJSON(baselinePath);

  // Inject candidate config path via env so solvers can optionally read it.
  process.env.HARNESS_CANDIDATE_CONFIG = candidatePath;
  let fresh;
  try {
    fresh = await runSuite(suite);
  } finally {
    delete process.env.HARNESS_CANDIDATE_CONFIG;
  }

  const candidateScores = {
    black_box: fresh.summary.black_box.pass_at_1,
    white_box: fresh.summary.white_box.pass_at_1,
  };
  const baselineScores = {
    black_box: baseline.summary.black_box.pass_at_1,
    white_box: baseline.summary.white_box.pass_at_1,
  };
  const { decision, rationale } = decideCandidatePromotion(candidateScores, baselineScores);

  const candidateResults = {
    suite,
    candidatePath,
    evaluatedAt: new Date().toISOString(),
    decision,
    rationale,
    candidateScores,
    baselineScores,
    outcomes: fresh.outcomes,
  };
  writeFileSync(join(dir, "candidate-results.json"), JSON.stringify(candidateResults, null, 2), "utf8");
  return candidateResults;
}

async function main() {
  const args = process.argv.slice(2);

  // Parse --candidate <path> and optional suite name.
  let candidatePath = null;
  const filteredArgs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--candidate" && args[i + 1]) {
      candidatePath = args[++i];
    } else {
      filteredArgs.push(args[i]);
    }
  }

  const only = filteredArgs[0];
  const suites = only ? [only] : listSuites();
  if (suites.length === 0) {
    console.log("bench: no suites found under bench/. Nothing to run.");
    return 0;
  }

  // Candidate mode: evaluate each suite against the committed baseline.
  if (candidatePath) {
    console.log(`bench: candidate mode — comparing against committed baseline (candidate: ${candidatePath})`);
    let anyReject = false;
    for (const suite of suites) {
      try {
        const r = await runSuiteCandidate(suite, candidatePath);
        const icon = r.decision === "promote" ? "✅" : r.decision === "hold" ? "⚠️" : "❌";
        console.log(`\n=== ${suite} (candidate) ===`);
        console.log(`  ${icon} ${r.decision.toUpperCase()}: ${r.rationale}`);
        console.log(`  baseline  black=${r.baselineScores.black_box}  white=${r.baselineScores.white_box}`);
        console.log(`  candidate black=${r.candidateScores.black_box}  white=${r.candidateScores.white_box}`);
        console.log(`  wrote bench/${suite}/candidate-results.json`);
        if (r.decision === "reject") anyReject = true;
      } catch (err) {
        console.error(`\n=== ${suite} === CANDIDATE FAILED: ${err.message}`);
        anyReject = true;
      }
    }
    if (anyReject) {
      console.error("\nbench: candidate REJECTED — one or more suites regressed.");
      return 1;
    }
    console.log("\nbench: candidate evaluated successfully.");
    return 0;
  }

  // Normal mode.
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
