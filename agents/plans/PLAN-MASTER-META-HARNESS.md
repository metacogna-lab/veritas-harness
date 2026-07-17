# PLAN-MASTER — Meta-Harness Completion & Root↔Harness Separation

**Status:** APPROVED — Approach **A (freeze + backfill)**; trunk = **`main`** (confirmed 2026-07-17)
**Authored:** 2026-07-17 (senior-engineer / AI-architect pass)
**Baseline:** local `main` @ `73f543e`; `origin/HEAD → state/consolidation-plan`
**Supersedes/absorbs:** `PLAN-PHASE-3.0-MODAL-SANDBOXES.md` §9 (Loop C) and its stale §1 "net-new sandbox" claim
**Governing constraint (user, 2026-07-17):** *Harnesses under `harness/` are never worked on directly. They are only ever produced by meta-harness functionality (`meta/` pipeline + `core/` + `base-scripts/` + templates/packs). All capability development happens in the meta layer; harnesses are regenerable outputs.*

---

## 0. The load-bearing decision (blocks everything below)

"Only created by the meta harness" collides with reality: `harness/veritas-example` contains
hand-built domain code (ingest, rsi, control-plane deltas, telemetry, jobs, server, persistence,
sandbox) that predates any template capable of generating it. Two ways to honour the constraint:

- **A — Freeze + backfill (non-destructive, recommended).** Treat the three existing harnesses as
  frozen artifacts. Do *no* new hand-edits inside `harness/`. Lift every capability up into the
  meta layer (`core/spine/`, `meta/templates/harness-template/`, capability packs, `base-scripts/`)
  until the pipeline can *regenerate* each harness. Prove parity with a regeneration diff test, then
  the harnesses become genuinely disposable. Existing domain code is preserved and used as the
  golden output the generator must reproduce.
- **B — Regenerate now (destructive).** Rebuild the template/packs first, then re-scaffold the
  harnesses, discarding the current `harness/` trees. Fast to "purity" but throws away working,
  tested domain code (243+ example tests) and risks silent capability loss.

**DECIDED: A** (confirmed 2026-07-17). Reaches harnesses-as-pure-output without destroying tested
work; every step reversible. §1–§10 proceed on A. Trunk = `main` @ `73f543e`; branch all work off
`main`, never push `main`/`state/consolidation-plan` without explicit confirmation.

---

## 1. Branch, worktree & plan-completeness reconciliation

1.1 **Branch truth.** Trunk is ambiguous: local `main` @ `73f543e` diverges from
`origin/HEAD → state/consolidation-plan`. Feature branches named in the old plans
(`feat/v0.3-api-jobs-postgres`, `feat/v3.0-sandbox-providers`) are **merged and deleted** — their
work is on `main`. Action: confirm with user whether `main` or `state/consolidation-plan` is the
integration trunk; align `origin/HEAD` accordingly. Until confirmed, branch off `main` and never
push `main`/`state/consolidation-plan` (memory: [[feedback-branch-push]]).
1.2 **Worktrees.** `git worktree list` shows only the primary; the `.claude/worktrees/` dir in the
snapshot is empty/stale. No dangling worktrees to reconcile. Prune `.claude/worktrees/` if empty.
1.3 **Plan completeness.** Per `agents/plans/archive/ARCHIVE_NOTE.md`, phases 00–08, PHASE2, and
FEATURE-1..4 are delivered. **Open plans:** (a) `PLAN-PHASE-3.0-MODAL-SANDBOXES` — sandbox providers
now *exist* but goal-loop completeness is unverified; (b) `deployment/` (docker/modal categories) —
analysis, not yet executed; (c) `06-risk-register.md` — standing. Action: verify 3.0 to done or
re-scope it under this master plan; keep deployment/risk-register as live references.
1.4 **Update the live plan** to point at this master plan and correct its stale "net-new sandbox"
claim.

## 2. Establish the gate baseline (do first, no edits)

Prove the current state is green before moving any code, so later diffs are trustworthy.
2.1 Root: `bun test` (meta suite). 2.2 Each harness: `bun install && bun run build && bun test &&
bun run doctor`; example also `bun run verify-claims && bun run bench`. 2.3 Record pass counts as
the regression oracle (research 178, example 243+ per the plan — verify, don't assume). Any red
here is a task before anything else.

## 3. Extract the shared 8-plane spine → `core/spine/` (the core of the constraint)

Root cause of "harnesses get edited directly": the spine is copy-forked 3×. Fix per invariant #8
(compose, don't fork).
3.1 Identify byte-identical files across `veritas-research` and `veritas-example` `src/` (plan §9:
41 of 52). 3.2 Create a `core/spine/` workspace package holding the single canonical copy of
safety, tools, evidence, parse, llm-core, mission-core, and the generic plane code. 3.3 Repoint the
template `meta/templates/harness-template/src/` to depend on `core/spine/` instead of embedding a
third copy. 3.4 Add a **drift test** (`meta/*.test.ts`) that fails CI if a spine file is forked back
into a harness — this is what *enforces* "don't work on harnesses directly." 3.5 The 11 diverged
files (e.g. `control/plane.ts` +176/-23) are domain deltas → they become template *slots* /
capability-pack overlays, not spine.

## 4. Make the template + capability packs able to generate a real harness

Goal: `bun run create-harness` produces a harness that builds, tests, and runs — not a stub.
4.1 Audit `meta/templates/harness-template/` against a freshly-created harness: does it boot the
ReAct loop, pass its own tests, and `doctor` clean? 4.2 Fill capability packs
(`meta/templates/skills/<pack>/`) so `starter` and `research` install the skills the domain
harness needs (ingest, analysis, loadouts) rather than hand-authoring them in `harness/`. 4.3 The
sandbox providers (`core/sandbox/` + provider impls) become a capability pack / core feature the
template wires in, not example-only code.

## 5. Backfill `veritas-example` capabilities into the meta layer (Option A engine)

For each capability currently living only in `harness/veritas-example/src/` (ingest, rsi, memory,
telemetry, jobs, server, persistence, sandbox, domain loadouts): decide **spine** (generic → §3),
**capability pack** (reusable domain → template/skills), or **domain slot** (truly example-only).
5.2 Move it to its home. 5.3 Regenerate `veritas-example` from the pipeline into a scratch dir and
**diff against the committed tree** — parity (or explained deltas) proves the generator reproduces
it. 5.4 Once parity holds, `harness/veritas-example` is officially generator output.

## 6. Root↔harness hygiene (finish plan §9 Loop C)

6.1 Move `harness/INSTALLATION.md` (create-harness/scaffold docs) → root `docs/`/`guides/`; harness
READMEs link up. 6.2 Normalize interface asymmetry: research has `.claude/commands/` + no
`scripts/`; example has `scripts/*.mjs` + `skills/` + no `.claude/`. Shared script logic →
`base-scripts/`; per-harness wrappers stay thin (pattern already proven by doctor/config). 6.3
Confirm no creation logic remains in `harness/`: current grep hits
(`solo-hackathon/src/cli.ts` help-string, `veritas-example/src/ingest/to-harness-spec.ts`) are
benign — `to-harness-spec.ts` correctly *delegates* to `meta/harness-spec.ts` and does not scaffold.
Keep as-is but add a lint/test asserting `harness/**` never imports a `create/scaffold/register`
*writer* from meta (reading the spec type is fine).

## 7. Validate `base-scripts/` + all created scripts (user task 4)

7.1 Inventory: `base-scripts/{doctor.mjs,veritas-config.mjs,lib/stats.mjs}`. 7.2 Run each against a
real harness cwd (`doctor.mjs`, `veritas-config.mjs`) and assert exit codes + output contract. 7.3
Add a test that every harness `package.json` references base-scripts (not a local duplicate). 7.4
For scripts *created* by scaffolding: after §4/§5, a freshly-created harness's `scripts/` must run
green (doctor, bench, verify-claims where applicable). 7.5 Update the base-scripts "adding a new
base script" contract if §3/§5 introduce shared script utilities.

## 8. Confirm a created harness actually executes for its goal (user task 2)

The proof that the meta-harness "works" is an end-to-end created-harness run.
8.1 `bun run create-harness demo-<x>` (via the `new-harness` skill). 8.2 In the created harness:
build, test, doctor. 8.3 Run a trivial mission end-to-end against a safe target (scope-gated,
provenance-checked) and confirm a report renders. 8.4 Confirm the 8 safety invariants hold in the
created harness (scope deny, fail-safe deny unattended, provenance, refuter, human-release). 8.5
Record as an eval under `agents/evals/`.

## 9. Verify Phase 3.0 sandbox/goal-loop to done (folds the old open plan)

9.1 `harness/veritas-example/src/sandbox/{local,docker,modal}-provider.ts` + `core/sandbox/` exist —
run `sandbox.test.ts`, confirm conformance. 9.2 Check whether the goal loop / `POST /v1/goals` and
`SandboxProvider` selection are wired and tested; if incomplete, finish per plan §3–§5 **but land
the capability in the template/core (§4), not by editing the example directly.** 9.3 Docker-before-
Modal gate stays. 9.4 Retire `PLAN-PHASE-3.0` into archive once its deltas live in the meta layer.

## 10. `/simplify` + land (user task 5)

10.1 Per work item: branch off the confirmed trunk → TDD → gates green → **run `/simplify` on the
changed code, apply fixes, re-run gates** → commit (conventional) → merge back → push (never main
without confirmation). 10.2 Final task, literally: run `/simplify` on the last commit as requested.
10.3 Update `agents/state/state-<datetime>.md` and `MEMORY.md` at the end.

---

## Execution order (numbered, senior-eng sequencing)

1. §0 decision confirmed (A vs B) → 2. §1 branch/plan reconcile → 3. §2 gate baseline →
4. §3 spine extraction + drift test → 5. §4 template/packs generate-real → 6. §7 base-scripts
validation → 7. §5 backfill example → regen parity → 8. §6 root↔harness hygiene →
9. §9 sandbox/goal-loop to done → 10. §8 created-harness E2E proof → 11. §10 `/simplify` + land.

**Added tasks surfaced during audit (not in the original 5):** §0 destructive-decision gate; §1.1
trunk disambiguation; §2 gate baseline; §3.4 drift test as the *enforcement* of the no-direct-edit
rule; §5.3 regeneration-parity diff; §6.3 meta-import lint; §8.4 safety-invariant re-proof in the
generated harness.

---

## Progress log

- **2026-07-17 (iter 1)** — §0 decided A + trunk=`main`. §1 branch/worktree reconciled (feature
  branches merged+deleted; only primary worktree; no dangling). §2 gate baseline established:
  meta 50✓, veritas-research 178✓ + doctor OK, veritas-example 323✓/7skip. **§7 found 3 real
  baseline defects (repo gates were red on `main`)** and fixed them (branch
  `fix/baseline-gates-green`, merged to `main` @ `47adfe8`): (1) `modal-provider.ts` literal
  `import("modal")` → tsc TS2307 build break, indirected the specifier; (2)+(3) `verify-claims.mjs`
  & `bench.mjs` base-scripts import depth `../../`→`../../../` (broken since `2fcf1f7`). Build now
  exits 0; verify-claims reproduces all 3 claims; bench green. Fixes were defect-restoration on
  frozen artifacts (Approach A); the two domain scripts' permanent home is a capability pack (§5/§7).
- **2026-07-17 (iter 2) — §3 done for research + example.** TDD: wrote `meta/spine-drift.test.ts`
  first, confirmed RED (`core/spine` didn't exist), then extracted. Found the true fork was **39
  files** (27 source + 12 test — one more than plan §9's "41 of 52/11 diverged" estimate; a
  `control/int-e2e.test.ts` had been added since that audit), verified their dependency closure
  never reaches domain code before moving. Moved them to `core/spine/{bench,config,control,
  evidence,llm,mission,orchestration,parse,safety,tools}/`; git detected 38 as renames, preserving
  blame. Added `@spine/*` path alias (`baseUrl "."`, resolves to `../../core/spine/*`) to both
  harness `tsconfig.json`s — confirmed Bun honors tsconfig `paths` at runtime, not just for `tsc`.
  Rewrote 214 import sites (80 research + 134 example) via a scripted codemod (path-resolved, not
  string-matched, to avoid false positives). `package.json` `test` script now runs
  `bun test meta core/spine`.
  Non-mechanical findings the byte-diff alone wouldn't have caught:
  - `config/index.ts` located its own `default.json`/`local.json` via `dirname(import.meta.url)` —
    correct when the file lived in the harness, silently wrong once centralized (it would have read
    `core/spine/config/*.json`, which doesn't exist). Fixed to resolve against `process.cwd()`,
    matching the convention `base-scripts/doctor.mjs` already uses. Confirmed no other moved file
    had a similar self-location dependency (`grep -rl "import.meta.url|__dirname|process.cwd()"`
    across all 39 → only this one).
  - `safety/human-release.test.ts` was byte-identical between harnesses but imports `../agent/
    index.ts` (domain, per-harness) — an integration test, not a pure spine test. Left in place per
    harness (imports rewired to `@spine/*` for the spine parts, `../agent/index.ts` stays local),
    matching the existing pattern for `agent/*.test.ts` and `mission/experience-store.test.ts`.
  - `config/index.test.ts` used a `configDirectory()` helper that, after the `process.cwd()` fix,
    only resolves correctly when run from inside a harness — broke when spine's own test suite runs
    from the repo root. Gave the test its own fixtures (`core/spine/config/fixtures/`) instead of
    reading a harness's committed config.
  - Five `.mjs` scripts (not touched by the `.ts`-only codemod) hardcoded relative imports into the
    old `src/` locations: `base-scripts/doctor.mjs`, `base-scripts/veritas-config.mjs`, both
    harnesses' `bench/scope-gate/solver.mjs`, `veritas-example/scripts/{bench,gen-int-smoke,
    verify-finding}.mjs`. `doctor.mjs`/`veritas-config.mjs` fixed with a local-then-spine fallback
    (keeps unmigrated harnesses working); the rest repointed directly.
  - `harness/veritas-example/src/rsi/fixtures/suite.json` names held-in/held-out test files by path
    for a real `spawnSync("bun", ["test", ...])` in `candidate-runner.ts` (human-gated RSI candidate
    evaluation, not covered by the `bun test` gate) — updated the now-spine-owned paths.
  - Both harnesses' `planes.ts` (`invariant #8` self-documentation, asserted by `planes.test.ts`)
    listed `src/<plane>` module paths for planes now owned by spine — updated to
    `../../core/spine/<plane>/...`; this is the one genuinely domain-owned file each harness keeps
    (per §3.5, diverged files stay), just with corrected pointers.
  - `harness/solo-hackathon` (scaffolded 2026-07-15) and `meta/templates/harness-template/` share a
    **third, independently-diverged** implementation of these same modules — different Mission
    (observation-log vs. transcript-seq) and evidence-gate contracts, not a copy. Confirmed via
    comment-stripped diff (not just prose differences). Migrating them is a real API port, not a
    mechanical dedup — **explicitly descoped this iteration**, tracked as the open §3.3 follow-up.
    `spine-drift.test.ts` enforces the dedup only against `MIGRATED_HARNESSES = ["veritas-research",
    "veritas-example"]`, with `solo-hackathon`/template named and reasoned about in a code comment
    so the exclusion is visible, not silent.
  Final gates, all green: root `bun test meta core/spine` 181/181 (incl. drift test); research
  build clean, 49/49 (was 178 — 129 tests now live once in spine instead of twice), doctor OK;
  example build clean, 194/194 + 7 pre-existing skips (was 323), doctor OK, `verify-claims`
  reproduces all 3 claims, `bench` clean, RSI suite 25/25, `gen-int-smoke.mjs` runs cleanly against
  spine imports (smoke-tested, artifact changes reverted — not an intended content change).
  Committed on `refactor/spine-extraction`, merged to `main`, pushed.
- **Open follow-up (not yet started):** §3.3 template + `solo-hackathon` migration to the canonical
  spine — requires porting their Mission/evidence-gate/tool-registry API to match `core/spine`'s
  (transcript-seq findings, async `readFileTool`, etc.), not a mechanical import swap. Until this
  lands, new harnesses created via `create-harness` still get the older, template-lineage
  implementation, not the deduplicated one.
- **2026-07-17 (iter 3) — §7 + §8.1/8.2 done; `/simplify` applied to iter 2's commit.**
  §7: ran `doctor.mjs`/`veritas-config.mjs` against all three registered harnesses (including
  unmigrated `solo-hackathon`, to prove the local-then-spine fallback works both directions).
  `base-scripts/lib/stats.mjs` had zero dedicated test coverage — added `stats.test.mjs`, wired
  `base-scripts` into the root `bun test` script.
  §8.1/8.2: ran `create-harness` end-to-end (`agents/evals/created-harness-executes.md`) — build/
  test/doctor/CLI green, invariants #1 (scope) and #3 (provenance) proven via the template's own
  `spine.test.ts`. **Concrete gap found:** the template's `cli.ts` implements only a `planes` verb —
  no mission-execution verb exists, so "the harness executes for its goal" is provable today only
  via the committed unit test, not the actual CLI surface. Rolled into the §3.3/§4 follow-up.
  `/simplify` (4 parallel agents: reuse, simplification, efficiency, altitude) on iter 2's commit —
  3 of 4 independently converged on the same finding. Applied: extracted the `doctor.mjs`/
  `veritas-config.mjs` duplicated local-then-spine fallback to `base-scripts/lib/resolve-spine.mjs`;
  hoisted `spine-drift.test.ts`'s redundant double `walkFiles()` call; deduped the `@spine/*`
  tsconfig alias (was hand-copied into both harness `tsconfig.json`s) into root
  `tsconfig.spine-paths.json`, extended by both — verified Bun resolves paths through an `extends`
  chain before applying. **One fix applied then reverted:** the altitude agent's strongest finding
  (`config/index.ts` silently returns `{}` when `CONFIG_DIR` doesn't exist, should fail loud) broke
  `solo-hackathon`'s `doctor` on the first regression sweep — that harness legitimately has no
  `src/config/` at all (its template lineage never shipped the config plane; it uses
  `ScriptedBackbone` instead of `loadConfig()`), so "missing CONFIG_DIR" isn't always a wrong-cwd
  bug. Reverted, full sweep re-run to confirm. Also found `solo-hackathon`'s `tsc` build is broken
  (readonly/mutable array mismatch in `src/agent/loadouts.ts`) — confirmed present on the original
  `73f543e` baseline via `git stash` + checkout, unrelated to any of this session's work, left as a
  known out-of-scope defect (not in `MIGRATED_HARNESSES`, not touched by this refactor).
  Gates: root 191/191; research build clean 49/49 doctor OK; example build clean 194/194+7skip
  doctor OK verify-claims 3/3; solo-hackathon doctor OK (tsc pre-existing-broken, noted above).
  Committed as `cef572d` (message required a `--amend` fix — shell backtick expansion mangled the
  first `-m` string; refixed via heredoc, a mechanical error not a content issue).
- **User clarification received mid-iteration (2026-07-17):** "The subfolders in harness/ must be
  part of the output from the root (meta-harness). They should not be operated on by the root
  meta-harness once created. The harness folder requires its own CLAUDE.md for separation." This
  sharpens the existing governing constraint (top of this doc): not just "don't hand-edit harness
  source," but the root meta-harness tooling itself (`meta/`, `base-scripts/`) should not reach into
  a harness and modify it post-creation — a harness, once created, is read/executed, never patched
  in place. Addressed by adding `harness/CLAUDE.md` (separation contract, next action this
  iteration). Does not retroactively invalidate iter 1/2's backfill work — Approach A was explicitly
  approved as a one-time transitional migration to *reach* the state where this separation holds;
  it does license new direct edits going forward.
- **Next:** §4 (port the template's/`veritas-research`'s mission-execution CLI so a created harness
  is usable beyond `planes`, and finish the Mission/evidence-gate API migration for
  `solo-hackathon`/the template — direct dependency of the §3.3 follow-up and the §8 gap above), or
  §6 (root↔harness hygiene: move `harness/INSTALLATION.md` to root docs, normalize the
  research/example interface asymmetry) — whichever the next session picks up.
