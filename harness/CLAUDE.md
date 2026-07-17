# CLAUDE.md — harness/ (read before editing anything under this directory)

## The rule

**Everything under `harness/<name>/` is output of the root meta-harness. Once created, a harness
is executed and read — never hand-edited.** The meta-harness pipeline (`meta/create-harness.ts`,
the capability packs under `meta/templates/`, the shared `core/spine/` package, and the shared
`base-scripts/`) is the only thing that writes into a harness's source. If a harness needs new
behavior, a bug fix, or a capability, the change belongs in the meta layer — not here — followed by
regenerating (or, for the two harnesses still mid-migration, re-syncing) the harness output.

This applies to Claude Code sessions and human contributors alike. If you are an agent and a task
asks you to "fix" or "add" something inside `harness/<name>/src/`, stop and ask: is the actual fix
one of —

- **`core/spine/`** — shared 8-plane infrastructure (safety, tools, mission, evidence, parse,
  llm-core, config, orchestration) consumed by every migrated harness via the `@spine/*` path
  alias. Bug in scope-gate logic, evidence gate, the tool registry, etc.? Fix it here, once.
- **`meta/templates/harness-template/`** — the scaffold every new harness starts from
  (`agent/`, `cli.ts`, domain slots). Missing a CLI verb, a starter tool, a loadout shape? Fix the
  template, not the one harness that happens to have surfaced the gap.
- **`meta/templates/skills/<pack>/`** — capability packs (`starter`, `research`, …) installed into
  a harness at creation time. New reusable domain capability? New pack or extend an existing one.
- **`base-scripts/`** — cross-harness operational scripts (`doctor.mjs`, `veritas-config.mjs`,
  `lib/`). Every harness references these via its own `package.json`, never a local copy.

If none of those fit and the gap is genuinely one-off to a single harness's domain logic (e.g. a
research-only ingest pipeline step), that domain code still lives inside that harness's `src/` —
but it arrived there via the create-harness pipeline (a capability pack), not a manual patch after
the fact.

## Why

Every previous fork of this codebase's 8-plane spine (three, at last count: `veritas-research`,
`veritas-example`, and the template itself) happened exactly the way "just patch it in this one
harness" always happens — a fix landed in one copy, was never carried to the others, and the
harnesses drifted until nobody could say which copy was current. `meta/spine-drift.test.ts`
mechanically enforces this for the migrated harnesses; this file is the human/agent-readable version
of the same rule for everywhere the test can't reach (domain code, template code, unregistered
harnesses).

## Current state (see `agents/plans/PLAN-MASTER-META-HARNESS.md` for the live detail)

- **`veritas-research/`, `veritas-example/`** — migrated onto `core/spine/`. Their remaining
  per-harness files (`agent/`, `cli.ts`, `control/plane.ts`, `planes.ts`, domain modules) are
  intentionally NOT spine — see each harness's own structure — but are still create-harness/backfill
  output, not a standing invitation to hand-edit.
- **`solo-hackathon/`, and any harness the current `meta/templates/harness-template/` produces** —
  *not yet* migrated onto `core/spine/`; they carry an older, independently-diverged implementation
  of the same modules (different Mission/evidence-gate/tool-registry contracts). Migrating them is a
  real API port, tracked as an open follow-up (plan §3.3/§4) — not a mechanical dedup, and not
  something to attempt piecemeal inside a single harness.

## The one sanctioned exception

The initial extraction of `core/spine/` out of `veritas-research`/`veritas-example` (2026-07-17) did
edit harness source directly — that was an explicitly user-approved, one-time backfill
("Approach A: freeze + backfill," see plan §0) whose entire purpose was to *reach* the state this
file now protects. It is not a precedent. Do not read it as license for further direct edits.
