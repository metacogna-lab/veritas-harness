# Phase 3.0 — Goal-Oriented Modal Sandboxes

**Status:** PLAN — approved for execution via outer loops below
**Revised:** 2026-07-15 (review-loop iteration 1) — v0.3 Features F1 (API), F2 (job runner), F3 (UI teardown), F4 (Postgres) all landed on the base branch (`e872147`, `55d400a`, `045d098`, `f8c0869`); former Loops A/B deleted, goal loop now builds directly on `src/server/` + `src/jobs/`; new Loop C added for root↔harness creation/execution separation and spine dedup (§9)
**Base branch:** `feat/v0.3-api-jobs-postgres` (integration branch for 3.0: `feat/v3.0-sandbox-providers`)
**Supersedes:** the Python `modal/runner.py` sketch in `docs/PHASE2_MODAL_EXECUTION.md` (design intent preserved; implementation moves to the TypeScript Modal SDK behind `SandboxProvider`)
**Correction to source directive:** the second provider is **Modal** (modal.com Sandboxes), not "Modular"/Firecracker/gVisor/Wasm. Modal runs gVisor-isolated sandboxes as a managed service and has a first-class TS SDK, so we stay in the bun/TypeScript stack.

---

## 1. Baseline map (directive step 1 — COMPLETE, do not redo)

Verified against `feat/v0.3-api-jobs-postgres` (2026-07-15):

| Directive assumption | Actual state | Consequence for design |
|---|---|---|
| "Docker-based imperative execution model" | Docker **packages** the harness (`harness/veritas-example/Dockerfile`, `ENTRYPOINT ["bun","run","dev"]`) and co-locates Postgres (`docker-compose.yml`). Missions execute **in-process** via `ControlPlane.start()` (`src/control/plane.ts`) | `DockerProvider` = formalize container-per-run execution of the existing image. The in-process path stays the default (`LocalProvider`) so nothing breaks |
| "Where stdout is collected" | Missions don't spawn subprocesses; telemetry is structured `HarnessEvent`s on an eventemitter3 bus → `StructuredLogger` (NDJSON `events.ndjson`) + `PgSink` (`src/telemetry/`) | Providers must normalize raw container stdout/stderr **into** `HarnessEvent`s; the bus is the single spine |
| "Introduce the new state machine" | Exists: `MissionStatus` = created/running/done/error/held; **jobs queue implemented** (`src/jobs/{types,queue,runner,executor}.ts`, F2 `55d400a`) | Goal-loop states **extend** the jobs status enum; no parallel state system |
| "Event dispatcher" (step 5) | Already shipped (telemetry W4: `src/telemetry/{bus,logger,pg-sink,reader}.ts`) | Step 5 = add a `ReportingSink` subscriber + report renderer only |
| "New API route" trigger | **Implemented**: hono server `src/server/{index,app,deps,sse}.ts` + `routes/jobs.ts` (`bun run serve`, F1 `e872147`); Next.js `app/` torn down to a README placeholder (F3 `045d098`) — the API is the only interface | `POST /v1/goals` is added to the existing hono app; no UI work anywhere in Phase 3.0 |
| Sandbox/goal-loop code exists? | `git grep` for SandboxProvider/goal/firecracker/gvisor = **zero hits** | Phase 3.0 is net-new; Strategy Pattern cutover is safe |

Existing touchpoints to wrap (do not mutate):
- `harness/veritas-example/src/control/plane.ts` — orchestrator; `start(StartInput)`
- `harness/veritas-example/src/control/store.ts` — FS `MissionStore` (`<runsDir>/<id>.json`)
- `harness/veritas-example/src/telemetry/index.ts` — `telemetryFromEnv()`, bus wiring
- `harness/veritas-example/src/persistence/{schema,repo,db,migrate,session}.ts` — Feature 4 (DONE)
- `harness/veritas-example/src/server/{index,app,deps,sse}.ts`, `routes/jobs.ts` — Feature 1 (DONE)
- `harness/veritas-example/src/jobs/{types,queue,runner,executor}.ts` — Feature 2 (DONE)
- `harness/veritas-example/Dockerfile`, `docker-compose.yml` — image + postgres
- `core/{schema,eval,dogma,plan-io,compile-brief}.ts` — shared domain

**Plans-completeness audit (2026-07-15):** every doc in `agents/plans/` is done — phases 00–08 (BASIC→INT→ADV→Skills→Consumability→Ingest→8-plane/RSI; all `feat/adv-*`, `feat/skills`, `feat/consumability`, `feat/harness-consolidate` branches merged), PHASE2.md (v0.2 workstreams merged), and PLAN-FEATURE-1/2/3/4 (commits above). The only open plan is this one. No unmerged remote branch carries unlanded work (`git branch -a --no-merged feat/v0.3-api-jobs-postgres` returns only this plan branch).

## 2. Ground rules (every loop, non-negotiable)

1. **No breaking changes.** Default behavior with no new flags/config = today's in-process execution. All Phase 2.0 CLI verbs, tests, and API contracts unchanged. Enforced by the Regression Eval gate (§5.1).
2. **Meta-harness stays complete.** Both registered harnesses (`harnesses.json` #1 veritas-research, #2 veritas-example) keep green `bun test` + `bun run doctor`; the 8 planes and 8 safety invariants (THOR.md) hold. Sandbox providers live in the **Execution Plane**; the goal loop lives in the **Control/Orchestration Planes** — no new plane, no forked agent loop (invariant #8).
3. **Evals at every phase.** No loop merges without its eval battery green (§5) plus the standing gates: `bun test` (research 178 / example 243+), `bun run doctor`, `bun run verify-claims`, `bun run bench`.
4. **Git discipline per loop:** branch off `feat/v3.0-sandbox-providers` → TDD → evals green → **run `/simplify` on the changed code before every commit** (reuse/simplification/efficiency pass; apply its fixes, re-run gates) → commit (conventional format) → merge back to `feat/v3.0-sandbox-providers` → push. Never push `main`/`state/consolidation-plan` without explicit human confirmation.
5. **Docker before Modal.** Loops 0–1 (Docker proven end-to-end: containerized int-smoke, then `DockerProvider` conformance) are a hard gate before any Modal work merges (Loop M may be *drafted* in parallel but not merged).
6. **Safety invariants in sandboxes:** unattended runs fail-safe deny gated tiers (#2); `requireHumanRelease` parks jobs as `held`/`AWAITING_RELEASE` — a sandbox exit is not a release (#5); `verify-claims` runs before artifacts are sealed (#6).
7. **Tools:** use the repo's meta-skills (`skills/harness-*`), `.claude/commands/`, and Modal's agent skills (`modal skills install --claude -y`, installed in Loop 0) rather than hand-rolling Modal knowledge.

## 3. Target architecture (deltas only)

```
core/sandbox/types.ts                 ← SandboxProvider interface + normalized results (shared, provider-agnostic)
harness/veritas-example/src/sandbox/
  local-provider.ts                   ← wraps today's in-process ControlPlane.start (DEFAULT)
  docker-provider.ts                  ← container-per-run on existing image (docker run/exec)
  modal-provider.ts                   ← Modal TS SDK: sandboxes.create → exec → terminate
  select.ts                           ← config/env routing: SANDBOX_PROVIDER=local|docker|modal (default local)
harness/veritas-example/src/goal/
  machine.ts                          ← PENDING → EVALUATING → EXECUTING → VERIFYING → COMPLETED|FAILED
  evaluator.ts                        ← Goal → next command; output+artifacts vs Goal (LLM via existing LLMBackbone)
core/report/schema.ts                 ← Zod ThorHarnessExecutionReport (v3.0) + JSON Schema export
harness/veritas-example/src/report/
  sink.ts                             ← ReportingSink subscribes to existing EventBus
  render.ts                           ← report.json + report.md per run
```

**SandboxProvider interface** (all providers, incl. Local, conform):

```ts
interface SandboxProvider {
  readonly name: "local" | "docker" | "modal";
  provision(spec: SandboxSpec): Promise<SandboxHandle>;         // image/volumes/secrets/timeout
  execute(h: SandboxHandle, cmd: ExecSpec): Promise<ExecResult>; // {exitCode, stdout, stderr, durationMs, startedAt}
  getLogs(h: SandboxHandle): AsyncIterable<HarnessEvent>;        // normalized onto the existing bus
  teardown(h: SandboxHandle): Promise<void>;                     // idempotent
  collectArtifacts(h: SandboxHandle): Promise<ArtifactManifest>; // path, action, sha256 (for reports)
}
```

**State machine** — one enum, superset of existing jobs statuses (old values remain valid; migration is additive):
`PENDING(≈queued) → EVALUATING → EXECUTING(≈running) → VERIFYING → COMPLETED(≈done) | FAILED(≈error) | AWAITING_RELEASE(≈held) | TIMEOUT | MAX_STEPS_REACHED`.
Loop: EVALUATING picks next command from Goal; EXECUTING runs it via the selected provider; VERIFYING checks output/artifacts against Goal (evidence-gated, invariant #3); loop back to EVALUATING until goal met / budget exhausted. Opt-in only: CLI `--goal "..."` on a new `goal` verb, or `POST /v1/goals` on the existing hono server.

## 4. Outer loops

Every loop runs the same inner cycle — **SYNC → RED → GREEN → GATE → SHIP → STATE**:
1. **SYNC** — re-read `agents/config/agents-config.md`, this plan, latest `agents/state/`; `git fetch`; branch from `feat/v3.0-sandbox-providers`.
2. **RED** — write the loop's tests + eval fixtures first; watch them fail.
3. **GREEN** — minimal implementation; immutable data, files ≤800 lines, no hand-edited registry.
4. **GATE** — loop-specific eval battery (below) **plus** standing gates: `bun test` in both harnesses, `bun run doctor`, `bun run verify-claims`, `bun run bench`, no hardcoded secrets.
5. **SHIP** — commit (`feat:`/`test:`/`docs:`), merge into `feat/v3.0-sandbox-providers`, push.
6. **STATE** — append a dated entry to `agents/state/build-log.md` (what shipped, eval numbers, next loop).

If GATE fails twice on the same cause, stop, write the failure into build-log, and re-plan the loop before a third attempt.

### Loop 0 — Baseline freeze & Docker gate *(serial; everything depends on it)*
Branch: `feat/v3.0-loop0-baseline`
- Create `feat/v3.0-sandbox-providers` off `feat/v0.3-api-jobs-postgres`; push.
- Prove Docker end-to-end on this machine: `docker compose up -d postgres` → healthy; build harness image; run the int-smoke mission **inside the container** (`docker compose run veritas start --plan bench/int-smoke/...`); confirm artifacts land in the mounted volumes and `verify-claims` re-derives them. Fix Dockerfile/compose drift if found. **This is the "Docker works" gate required before any Modal merge.**
- Record baseline numbers (test counts, bench pass@1 + Wilson CIs, image build time) in `agents/state/state-<date>-phase3-baseline.md` — these are the regression oracle.
- `modal skills install --claude -y` at repo root; `modal token`/workspace check; `bun add modal` in veritas-example (no usage yet).
- GATE: standing gates + containerized int-smoke green. SHIP.

### Loop 1 — `SandboxProvider` interface + `LocalProvider` + `DockerProvider` *(serial; unlocks all parallel tracks)*
Branch: `feat/v3.0-loop1-provider-interface`
- Add `core/sandbox/types.ts`; implement `LocalProvider` (delegates to `ControlPlane.start` — behavior-identical) and `DockerProvider` (provision = `docker run -d` on existing image with volume mounts; execute = `docker exec`; logs = `docker logs --follow` normalized to `HarnessEvent`; teardown = `rm -f`, idempotent).
- Route mission execution through `selectProvider()`; `SANDBOX_PROVIDER` unset ⇒ `local` ⇒ byte-identical behavior.
- Build **Eval 1 (Regression)** and **Eval 2 (Conformance)** harnesses now (§5); run conformance over local+docker.
- GATE: Eval 1 zero-drift vs Loop 0 baseline; Eval 2 local↔docker parity; standing gates. SHIP.

### Parallel wave — after Loop 1 merges, run Loops C and M-draft concurrently
Use one git worktree + one subagent per loop; each owns disjoint directories to avoid merge conflicts. Merge order into the integration branch: **C → G → M → R** (rebase later loops on earlier merges).

### Loop C — Root↔harness separation & spine dedup *(parallel with M-draft; dirs: `core/`, `meta/`, `harness/*/src` shared-spine files, `harness/INSTALLATION.md`)*
Branch: `feat/v3.0-loopC-separation` — executes the §9 audit findings:
- **Creation logic out of `harness/`**: move `harness/INSTALLATION.md` content into root docs (`docs/` or `guides/`) / `meta/`; after this, `harness/` contains only executable harnesses (`veritas-research`, `veritas-example`). `new-loadout` stays (loadout registration is domain *extension*, execution-side per invariant #8).
- **Single-source the spine**: extract the 41 byte-identical `src/` files (audited 2026-07-15: safety/, tools/, evidence/, llm/ core, mission/ core, parse/, planes) into a root workspace package (`core/spine/`, imported by both harnesses via bun workspaces). Diverged files (11, e.g. `control/plane.ts` +176 in example) stay per-harness but must import shared parts. `meta/templates/harness-template/` shrinks to thin scaffolding that depends on `core/spine` instead of carrying a third copy.
- **Drift guard**: extend the existing planes drift test to fail CI if a harness re-declares a file that `core/spine` exports.
- Do this **before** Loop G so the goal loop lands once, in shared code, not in a fork.
- GATE: both harnesses' full test suites unchanged-green (178/243+), `bun run create-harness` smoke (scaffold a throwaway harness, run its tests, deregister), Eval 1, standing gates. SHIP.

### Loop G — Goal-oriented control loop *(serial; needs 1 and C merged)*
Branch: `feat/v3.0-loopG-goal-loop` — dirs: `src/goal/`
- `machine.ts` state machine as a job type `"goal"` on the **existing** jobs queue (`src/jobs/types.ts` — additive status-enum extension per §3); `evaluator.ts` uses the existing `LLMBackbone` to pick the next command and to verify output/artifacts against the Goal; every verification claim must cite a tool observation (evidence gate) and hard budgets enforced (`max_steps`, `timeout_seconds` → TIMEOUT / MAX_STEPS_REACHED).
- Opt-in triggers only: CLI verb `goal --goal "..." [--provider docker] [--max-steps N]` + `POST /v1/goals`; zero changes to existing verbs/routes.
- Provider-agnostic: goal loop calls `SandboxProvider` only — never docker/modal APIs directly.
- Build **Eval 3 (Agentic loop)**; GATE: Eval 3 + Eval 1 + standing gates. SHIP.

### Loop M — `ModalProvider` *(draft in parallel after Loop 1; MERGE only after Loop 0 Docker gate + Loop G; dirs: `src/sandbox/modal-provider.ts`)*
Branch: `feat/v3.0-loopM-modal-provider`
- Modal TS SDK: `apps.fromName("veritas", {createIfMissing:true})`; image from the existing Dockerfile; provision = `sandboxes.create(app, image)` with `veritas` secret (ANTHROPIC_API_KEY etc. via Modal secret store, never in code) and `veritas-missions` Volume mounted for artifacts; execute = `sb.exec([...], {timeoutMs})` capturing stdout/stderr/`returncode`; teardown = `sb.terminate()`; timeout ceiling 3600s (matches PHASE2 doc).
- Config routing: `SANDBOX_PROVIDER=modal`. Docker stays the container default; local stays the global default.
- Mark `docs/PHASE2_MODAL_EXECUTION.md` superseded-by-this-plan (keep for design record).
- GATE: **Eval 2 conformance across all three providers** (identical workload ⇒ identical normalized ExecResult shape, exit codes, timing metadata present); Eval 3 re-run with `--provider modal`; Eval 1; standing gates. Tests requiring Modal credentials guard-skip when `MODAL_TOKEN_ID` unset (same pattern as `DATABASE_URL` tests). SHIP.

### Loop R — Reporting engine *(parallel with M after G; dirs: `core/report/`, `src/report/`)*
Branch: `feat/v3.0-loopR-reporting`
- `core/report/schema.ts`: Zod schema for **ThorHarnessExecutionReport** exactly per §6, plus emitted JSON Schema artifact committed at `agents/docs/thor-harness-execution-report.schema.json`.
- `ReportingSink` subscribes to the existing bus (same non-throwing contract as `PgSink`); on terminal states (COMPLETED/FAILED/TIMEOUT/MAX_STEPS_REACHED) aggregates telemetry + timeline + `collectArtifacts()` (sha256 per file) → writes `<runsDir>/<id>/report.json` + `report.md`; served at `GET /v1/missions/:id/report`.
- Build **Eval 4 (Telemetry & reporting)**; GATE: Eval 4 + schema validation of emitted reports + standing gates. SHIP.

### Loop Z — Meta-harness closure *(serial, last)*
Branch: `feat/v3.0-loopZ-closure`
- Propagate provider interface + report schema to the template harness `harness/veritas-research` (spine-only, no domain logic) so new harnesses stamp out with sandbox support; regenerate via the ordered pipeline, never hand-edit `harnesses.json`.
- New meta-skill `skills/harness-sandbox-runner/` (select provider, run goal, fetch report) + eval doc `agents/evals/skill-sandbox-runner.md`; update THOR.md §Execution Plane, CLAUDE.md, docs/OPERATIONS_PLAN.md, CLI.md.
- Full battery: all four eval suites over local+docker(+modal if creds), both harnesses' tests, bench, verify-claims, doctor.
- Final state snapshot `agents/state/state-<date>-phase3-complete.md`; SHIP; open PR from `feat/v3.0-sandbox-providers` → default branch. **Stop for human review — do not merge the PR autonomously.**

## 5. Eval framework (built as bench suites, wired into `bun run bench` + `verify-claims`)

All four live under `harness/veritas-example/bench/` using the existing pattern (`tasks.json` + `solver.mjs` + `oracle.json` → `results.json` with pass@1 + Wilson-95 CI), with the anti-fitting guard (solvers task-agnostic; held-out tasks separate). Built in the loop that first needs them; re-run in **every** subsequent GATE.

1. **`bench/sandbox-regression/` — the No-Breaking-Changes gate** (from Loop 1): replays the Phase 2.0 surface — int-smoke mission via default path, every CLI verb snapshot, API contract hashes — and diffs against the Loop 0 baseline. Success: zero drift; container spins up, echo-style workload executes, logs return, clean teardown through `DockerProvider`.
2. **`bench/provider-conformance/`** (from Loop 1; extended in M): identical workloads (`touch test.txt && ls`; multi-command; nonzero-exit; timeout) across every configured provider. Success: identical normalized ExecResult structure, matching exit codes, timing metadata present, artifact manifests equivalent.
3. **`bench/goal-loop/`** (from Loop G): multi-step goal "create hello.txt containing 'world', then read it" — must EVALUATE → EXECUTE (write) → VERIFY → EXECUTE (read) → VERIFY output matches → halt COMPLETED autonomously; plus budget tasks proving TIMEOUT/MAX_STEPS_REACHED halt states.
4. **`bench/reporting/`** (from Loop R): one engineered success + one engineered failure ("read a file that does not exist"). Success: both emit schema-valid ThorHarnessExecutionReport JSON + Markdown; success report carries correct outputs and ordered event sequence; failure report carries exact error, FAILED state, and full attempt timeline.

## 6. Report contract — `ThorHarnessExecutionReport` (schema_version "3.0")

Canonical shape (authoritative copy → `core/report/schema.ts` as Zod + committed JSON Schema). Field mapping to existing architecture:

| Schema field | Source in architecture |
|---|---|
| `metadata.run_id / timestamps / schema_version` | job row + session (`src/persistence/schema.ts`) |
| `metadata.provider` | `SandboxProvider.name` — **enum corrected to `["local","docker","modal"]`** (directive's `firecracker`/`wasm` dropped per Modal decision; enum stays open for future providers) |
| `goal_context.original_prompt / constraints` | goal job `spec` (`timeout_seconds`, `max_steps`) |
| `execution_summary.final_status` | terminal machine state: COMPLETED / FAILED / TIMEOUT / MAX_STEPS_REACHED |
| `execution_summary.total_duration_ms / steps_taken / failure_reason` | aggregated from bus events |
| `timeline[]` | `events.ndjson` / `events` table; `action_type` EVALUATE/COMMAND/FILE_OP from machine transitions; `command_executed/exit_code/stdout/stderr/duration_ms` from `ExecResult` |
| `artifacts[]` | `collectArtifacts()` manifest — `file_path`, `action` CREATED/MODIFIED/DELETED (pre/post diff), `sha256_hash`, `storage_uri` (runsDir path or Modal Volume URI) |

Required blocks: `metadata`, `goal_context`, `execution_summary`, `timeline`, `artifacts` — all enforced by Zod at emit time; an invalid report is itself a FAILED gate.

## 7. Dependency & parallelism map

```
Loop 0 ──► Loop 1 ──┬─► Loop C (separation/dedup) ─► Loop G (goal loop) ─┬─► Loop M (Modal; merge-gated on 0+G)
 (Docker gate)      └─► Loop M draft ····································┤─► Loop R (reporting)
                                                                         └─► Loop Z (closure, PR, human review)
```
(F1 API, F2 jobs, F3 UI-teardown, F4 Postgres already landed on the base branch — no loops needed.)

## 8. Risks

| Risk | Mitigation |
|---|---|
| Docker drift on dev machine blocks everything | Loop 0 is dedicated to proving/fixing it before any feature work |
| Provider divergence (docker vs modal semantics) | Conformance eval is a merge gate for every later loop |
| Goal-loop runaway (steps/tokens) | `max_steps` + `timeout_seconds` budgets enforced in machine; TIMEOUT/MAX_STEPS_REACHED are first-class terminal states |
| Modal creds absent in CI | guard-skip pattern (as `DATABASE_URL`); conformance runs local+docker minimum |
| Parallel loops collide | disjoint directory ownership per loop; fixed merge order C→G→M→R; rebase before merge |
| Spine dedup (Loop C) destabilizes both harnesses at once | 41 extracted files are byte-identical today — extraction is mechanical; both suites must stay green in the same commit; drift test locks it |
| Meta-harness incompleteness sneaks in | Loop Z re-runs full battery on **both** harnesses + registry pipeline check |

## 9. Root↔harness separation audit (2026-07-15, review-loop iteration 1)

Rule: **meta/creation logic lives at the root (`meta/`, `core/`, `base-scripts/`, root `skills/`); `harness/` contains only executable harnesses.** Findings on `feat/v0.3-api-jobs-postgres`:

| Finding | Evidence | Disposition (Loop C) |
|---|---|---|
| 8-plane spine is copy-forked **three ways** | Of 52 shared `src/` paths between `harness/veritas-research` and `harness/veritas-example`, **41 are byte-identical** (safety, tools, evidence, parse, llm core, mission core, planes); 11 diverged (`control/plane.ts` +176/-23). `meta/templates/harness-template/src/` carries a third ~16-file copy | Extract identical files → `core/spine/` workspace package; harnesses + template depend on it; drift test guards regression (invariant #8: compose, don't fork) |
| Creation doc inside `harness/` | `harness/INSTALLATION.md` covers create-harness/scaffold usage | Move to root `docs/`/`guides/`; `harness/` READMEs link to it |
| Interface asymmetry between harnesses | research has `.claude/commands/` (9 cmds) + no `scripts/`; example has `scripts/*.mjs` (7) + `skills/` + no `.claude/` | Normalize in Loop C: shared script logic → `base-scripts/` (pattern already proven by `doctor.mjs`/`veritas-config.mjs`); per-harness wrappers stay thin |
| Root duplication already resolved elsewhere | `app/` ingest duplication removed by F3 (`045d098`); `base-scripts/` already shares doctor/config | No action — confirms the direction |

Non-findings (correct as-is): `harness/veritas-example/skills/{harness-analysis,harness-ingest}` are execution-side domain skills; `new-loadout` is domain extension, not harness creation; root `skills/harness-*` (8 generic meta-skills) and `meta/` pipeline correctly live at root.
