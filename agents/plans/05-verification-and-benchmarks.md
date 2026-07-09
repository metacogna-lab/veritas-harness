# Plan 05 — Verification and Benchmarks (cross-cutting)

This plan is not a phase — it's the set of verification practices that run *across* every
phase above. Treat every checkbox here as a standing requirement, not a one-time task.

## Layered verification, by phase

| Layer | Introduced in | What it guarantees | Enforcement point |
|-------|---------------|---------------------|---------------------|
| Unit tests per module | 01 (BASIC) | Each module (`llm`, `config`, `safety/scope`, `tools`, `parse`, `mission`, `agent`) is correct in isolation | `bun test`, one `*.test.ts` per module |
| Fail-safe-deny tests | 02 (INT) | An unattended run never silently fires a gated tool | `src/safety/approval.test.ts` |
| Provenance tests | 02 (INT) | No finding without a real tool observation behind it | `src/evidence/gate.test.ts` |
| Refuter tests | 02 (INT) | A second model instance genuinely tries to disprove a finding before promotion | `scripts/verify-finding.mjs` + a known-false-finding test |
| Reproducibility gate | 02 (INT) | Every headline number re-derives from committed artifacts | `bun run verify-claims`, wired to a git pre-push hook |
| Health check | 02 (INT) | Environment (provider reachability, PATH tools, config) is sane before a mission starts | `bun run doctor` |
| Benchmark + anti-fitting guard | 03 (ADV) | Reported capability numbers are graded against a committed oracle, not tunable to the test set | `bun run bench` → `bun run verify-claims` |
| Honest-decomposition test | 03 (ADV) | Orchestrator workers always get a truthful subtask description | `src/orchestration/orchestrator.test.ts` |
| Terminal-action gate test | 03 (ADV) | The harness never auto-executes a consequential action | end-to-end test per Loadout with a terminal action |
| No-bypass-via-MCP test | 04 (Consumability) | The MCP surface enforces the same gates as direct calls | `src/mcp-server.test.ts` |

## Standing rules for any new benchmark suite (per `bench/<suite>/`)

- [ ] `tasks.json` and a committed `oracle.json` — ground truth is never generated at
      grading time
- [ ] Held-out tasks live in a file separate from any tasks used while tuning prompts
- [ ] Grading logic must not reference the specific test answers — the anti-fitting guard
      fails the build if it does
- [ ] Black-box and white-box results are computed and reported separately; never blended
      into a single number
- [ ] Small sample sizes are reported as directional (state the n, and a confidence
      interval such as Wilson-95) — never presented as definitive with n below ~30

## Standing rule for any reported number

Anything that appears in a report, a CLAUDE.md, a PR description, or a status output and
is derived from a mission run or benchmark must be reproducible by `bun run verify-claims`
from committed artifacts. If it can't be reproduced, it doesn't ship — this is enforced by
the pre-push hook, not by review discipline alone.

## What lives in `agents/evals/` vs. `harness/bench/`

- `harness/bench/<suite>/` — the harness's own capability benchmarks (does the built agent
  perform its purpose correctly), graded against committed oracles, part of the shipped
  harness.
- `agents/evals/` — evaluation of the meta-harness *build process* itself (e.g., did a
  given Loadout registration actually satisfy the Definition of Done in
  `02-phase-int.md` §2.1; did a skill invocation actually leave tests green). This
  directory is currently empty and should be populated as work against these plans
  proceeds — one eval record per meaningful unit of delivered work, referencing which
  plan/task it verifies.

## Definition of done

- [ ] Every phase's DoD in `01`–`04` references and satisfies the layered-verification row
      that applies to it
- [ ] `bun test`, `bun run verify-claims`, and `bun run doctor` are all green at each phase
      boundary before the next phase's tasks begin
- [ ] At least one populated benchmark suite exists satisfying every standing rule above
