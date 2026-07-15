# Plan 03 — Phase ADV: Orchestration, Benchmarking, Self-Improvement

Goal: a harness that plans across models, measures itself, and improves — without
compromising anything BASIC or INT established.

Dependencies: Phase INT's DoD is met (`02-phase-int.md`). Do not start 3.1 until the
approval gate, evidence gate, and refuter are all green under test — orchestration
multiplies whatever trust posture already exists, good or bad.

## Tasks

### 3.1 Multi-model orchestrator — `src/orchestration/orchestrator.ts`
- [ ] Master-builder decomposes a large objective into independent sub-queries, dispatches
      to worker agents (optionally cheaper models) in parallel with bounded concurrency
- [ ] Synthesizes results over rounds with an accumulated-knowledge memory
- [ ] Context-packs each worker under a token budget
- [ ] **Hard scope constraint, verified by test, not just code review**: this is a
      workload-decomposition pattern only (parallelism, cost, context budgeting). Each
      worker receives an honest, complete description of its subtask. The orchestrator must
      never construct a worker prompt that omits or obscures the parent objective's intent
      in a way designed to route around a worker model's own safety behavior — see
      `06-risk-register.md` for why this is a hard boundary, not a style preference
- [ ] Tests for round synthesis, concurrency limits, and — specifically — a test asserting
      worker prompts always contain a complete, truthful subtask description (no
      context-isolation-by-construction)

### 3.2 Benchmark harness — `scripts/bench.mjs` + `bench/<suite>/`
- [ ] Each suite: `bench/<suite>/tasks.json` (tasks) + `bench/<suite>/oracle.json`
      (committed ground truth)
- [ ] Grade every result against the oracle — never against a model self-report
- [ ] Compute pass@1 with a Wilson-95 confidence interval; write results as committed JSON
      that `verify-claims` (2.6) re-derives
- [ ] Anti-fitting guard: fail the build if grading logic references the specific test
      answers; keep held-out tasks in a file separate from any tasks used to tune prompts
- [ ] Report black-box and white-box variants separately — never blended into one number
- [ ] Wire as `bun run bench`

### 3.3 Human-gated terminal actions
- [ ] `requireHumanRelease(action)` checkpoint for any consequential terminal action in a
      Loadout's target domain (sending, publishing, deleting, deploying, disclosing, or the
      domain-equivalent)
- [ ] On reaching such an action, the harness stops one step short and produces a
      draft/plan; nothing executes without explicit human approval
- [ ] Test asserting the harness never auto-executes a terminal action end-to-end, even
      when running unattended/headless

### 3.4 Lessons / self-improvement loop — `scripts/lessons.mjs` + `src/resources/lessons.ts`
- [ ] After each mission, extract structured lessons (what worked, what failed, prompt/tool
      gaps) into a committed store
- [ ] `retrieveLessons(objective)` so a future mission's planning step CAN load relevant
      past lessons into context
- [ ] Mark explicitly in code comments/docs which part is live (recording lessons) vs.
      roadmap (automatic feedback into planning) — do not silently expand scope to "the
      harness learns" without that being a deliberate, separately-planned decision

## Definition of done

- [ ] `bun test` green, including the honest-decomposition assertion test for 3.1
- [ ] `bun run bench` produces committed results for at least one suite, `bun run
      verify-claims` re-derives them successfully, and the anti-fitting guard is exercised
      by a deliberately-bad test case that fails the build
- [ ] At least one Loadout has a terminal action gated by `requireHumanRelease`, and the
      "never auto-executes" test passes
- [ ] Lessons are recorded from at least one real mission run and `retrieveLessons()`
      returns them; the roadmap-vs-live boundary is documented in `src/resources/lessons.ts`
