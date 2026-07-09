---
name: harness-eval-runner
description: >-
  Run or add harness benchmark suites. Use when the user asks to "benchmark",
  "evaluate the harness", "add an eval", "measure pass@1", run bench, or verify
  reported capability numbers against a committed oracle.
---

# Harness Eval Runner

Benchmark the harness against committed ground truth — never against a model self-report.

## Steps

1. Read `harness/veritas-research/scripts/bench.mjs` for the runner contract:
   - Each suite lives under `bench/<suite>/`
   - Requires `tasks.json`, `oracle.json`, and `solver.mjs`
   - Grades against oracle only; anti-fitting guard scans solver source
   - Black-box and white-box pass@1 reported separately (never blended)
2. To add a suite:
   - Create `bench/<suite>/tasks.json` (task ids, mode `black` or `white`, inputs)
   - Create `bench/<suite>/oracle.json` (committed ground truth — never generated at grade time)
   - Put held-out tuning tasks in `bench/<suite>/heldout.json` (separate file)
   - Create `bench/<suite>/solver.mjs` exporting `solve(input)` — **task-agnostic** (no task id literals, no embedded oracle answers)
3. Run the suite:

```bash
cd harness/veritas-research
bun run bench <suite>
```

4. Commit `bench/<suite>/results.json` produced by the runner.
5. Add or update `claims.json` entries with kind `bench_pass_at_1` (separate claims per mode).
6. Re-derive headline numbers:

```bash
bun run verify-claims
```

If `verify-claims` fails, the eval is not trustworthy — fix before reporting any number.

## Standing rules

- Grading logic must not reference specific test answers (anti-fitting guard fails the build if it does).
- Small sample sizes: report n and Wilson-95 CI; never present n < ~30 as definitive.
- Anything in a report must reproduce via `verify-claims` from committed artifacts.

## Don't mark done until

`bun run bench` and `bun run verify-claims` both exit 0 for the suite you added or modified.
