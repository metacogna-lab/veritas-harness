# Plan 00 — Overview: The Multi-Purpose Harness

Grounded in `agents/docs/` (source PDFs) and `agents/docs/processed/` +
`agents/docs/reports/` (the extracted strategy/operational/tactics notes and strategy
report). This overview indexes the plan set and states scope, sequencing, and the
definition of done for the whole build.

## What "multi-purpose" means here

A single agent loop, tool registry, and safety/evidence spine that is reused unchanged
across domains. A "purpose" (a target objective, e.g. "audit a codebase," "triage support
tickets," "run authorized recon") is added by registering a **Loadout** — a tool subset +
specialist personas + a target adapter + a benchmark suite — never by forking the loop,
the gates, or the ledger. Multi-purpose is a property of the loadout registry, not of the
core.

## Plan index

| Plan | Covers | Tier |
|------|--------|------|
| [01-phase-basic.md](01-phase-basic.md) | Model abstraction, ReAct loop, tool registry, scope gate, parser, mission object | BASIC |
| [02-phase-int.md](02-phase-int.md) | Loadouts, approval gating, evidence ledger, refuter, control plane, reproducibility guard | INT |
| [03-phase-adv.md](03-phase-adv.md) | Honest multi-model orchestration, benchmark harness, human-gated terminal actions, lessons loop | ADV |
| [04-phase-skills-and-consumability.md](04-phase-skills-and-consumability.md) | Self-extension skills, CLAUDE.md, slash commands, subagents, MCP exposure | Skills + Consumability |
| [05-verification-and-benchmarks.md](05-verification-and-benchmarks.md) | Cross-cutting: eval suites, reproducibility CI gate, health checks | Cross-cutting |
| [06-risk-register.md](06-risk-register.md) | Known risks, open questions, explicit boundaries | Cross-cutting |

## Sequencing (non-negotiable order)

Build strictly bottom-up: BASIC → INT → ADV, with Skills and the Consumability layer
following once ADV is stable. Do not begin a later phase's tasks until the prior phase's
definition of done is met — each tier's safety and trust properties are a precondition
for the next tier's added capability, not decoration on top of it.

## Target layout (build output, under `harness/`)

```
harness/
  src/llm/            provider abstraction
  src/config/         typed config, key resolution, redact()
  src/agent/          ReAct loop + specialists.ts (loadouts)
  src/safety/         scope.ts + approval.ts, composed as index.ts check()
  src/tools/          typed ToolRegistry
  src/parse/          robust JSON extraction from model output
  src/mission/        the Mission object — append-only transcript + findings
  src/evidence/       provenance gate + refuter
  src/orchestration/  ADV-tier decomposition orchestrator (honest decomposition only)
  scripts/            verify-claims.mjs, verify-finding.mjs, bench.mjs, doctor.mjs, lessons.mjs
  skills/             harness-tool-adder/, harness-eval-runner/, harness-refuter/
  .claude/            commands/, agents/
  bench/<suite>/      tasks.json + committed oracle.json per suite
```

Stack: TypeScript on Bun (`bun install`, `bun run <script>`, `bun test`), `zod` for typed
tool schemas, `eventemitter3` for the agent loop's event bus — as documented in
`agents/docs/processed/tactics.md`.

## Definition of done (whole build)

- [ ] All six plan documents' individual DoDs are met (see each file).
- [ ] `bun test` green, `bun run verify-claims` green, `bun run doctor` green.
- [ ] At least one end-to-end Loadout runs a trivial objective through the full BASIC+INT
      spine (scope gate → tool call → evidence → refuter → reproducible report).
- [ ] The eight non-negotiable safety invariants (see `06-risk-register.md`) hold under
      test, not just by inspection.
- [ ] A second Loadout can be registered for a different objective using only
      `src/tools/`, `src/agent/specialists.ts`, and a new target adapter — with zero
      changes to the loop, gates, ledger, refuter, or control plane. This is the proof
      that the harness is actually multi-purpose.
