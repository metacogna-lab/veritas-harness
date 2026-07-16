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
- **Next:** §3 — extract the 3×-forked 8-plane spine into `core/spine/` + drift test (the
  enforcement mechanism for "harnesses are never edited directly").
