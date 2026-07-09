# Harness State — 2026-07-09 (meta-harness elevation)

Snapshot after elevating the repo root into a meta-harness and adding the eight-plane
+ RSI foundation. Supersedes the structural notes in `state-2026-07-09T1716.md`
(build phases BASIC/INT/ADV remain COMPLETE there).

## What changed

The root `veritas/` was a documentation root; it is now a **meta-harness** that owns
every harness under `harness/`. Delivered as 6 numbered features, each on its own
branch → merged `--no-ff` into `develop`.

| # | Branch | Delivers |
|---|--------|----------|
| 1 | `feat/meta-harness-root` | `meta/` engine (registry, manifest), `harnesses.json`, `meta/templates/harness-template` (real 8-plane spine), root meta CLIs |
| 2 | `feat/harness-new-pipeline` | `meta/create-harness.ts` ordered pipeline + capability packs + `/new-harness` |
| 3 | `feat/skill-reclassification` | generic skills hoisted to root `skills/`; research skills kept in-harness + as `research` capability pack; `harness.json` for veritas-research (#1) |
| 4 | `feat/lessons-planning-feedback` | opt-in `retrieveLessonsForPlanning()` (RSI seed) |
| 5 | `feat/eight-plane-formalization` | `src/planes.ts` + drift test; `src/memory/context-window.ts`; `agents/plans/08-eight-plane-and-rsi.md` |
| 6 | `feat/rsi-self-improve-loop` | `src/rsi/` skeleton (mine → propose → validate → human-gated apply); `veritas rsi` dry-run |

## Invariants honored

- **#3 skills for the system, not one harness** — generic skills at meta root; harness-specific
  skills initialized into `harness/<name>/skills/` at creation time.
- **#4 ordered init into harness/** — `create-harness` is the only sanctioned path; validates,
  scaffolds in canonical order, registers with a monotonic index.
- **#5 human before consequence** — RSI `apply.ts` routes through `requireHumanRelease`; never
  auto-applies a self-edit. Ineligible proposals are never offered.
- **#7 honest decomposition** — proposer context is bounded + truthful; `assertHonestContext`.
- **veritas-research is conformed via manifest only — never regenerated.**

## Verification (all green)

- `bun test meta` → 30 pass. `bun run harness-doctor` → healthy. `bun run list-harnesses` → #1.
- `harness/veritas-research`: `bun test` → 218 pass; `bun run verify-claims` → 3 claims reproduced.
- E2E: `bun run create-harness demo-x --capabilities starter` scaffolds a harness whose own
  `bun test` is green (verified in scratchpad, discarded).

## Known pre-existing issue (out of scope, not introduced here)

`harness/veritas-research/src/resources/source-digest.ts` has 8 `tsc` errors (CompletionRequest/
CompletionResult shape mismatch). Predates this work; tests pass because bun runs TS directly.
Worth a follow-up `fix/source-digest-types`.

## Not done (deliberate)

- HTTP server `src/server.ts` (deferred — optional; CLI covers the contract).
- Autonomous application of validated RSI edits (roadmap; would violate #5).
- Pushes: all work is on local `develop` + feature branches; nothing pushed yet.
