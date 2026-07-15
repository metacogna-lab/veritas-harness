# Eval — Interactive CLI shell (planning + ingest)

**Date:** 2026-07-15  
**Scope:** `harness/veritas-example/src/interactive/*`, `src/cli.ts` interactive entry, `meta/veritas.ts` bare argv → `interactive`.

## Definition of done → evidence

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Persistent REPL with `▸ veritas` prompt | ✅ | `shell.ts` + `printPromptPrefix()`; scripted tests via injectable `ask` |
| Natural-language planning → draft ResearchPlan | ✅ | `planner.ts` `planTurn` + mock-LLM tests |
| Slash commands for plan/ingest/eval/write/start | ✅ | `commands.ts` + `shell.ts` dispatch |
| `/write` blocked until required dogma passes | ✅ | `cmdWrite` + shell/planner tests |
| Stdin approver for gated tools on `/start` | ✅ | `approver.ts` + unit test |
| Bare TTY / `interactive` verb; non-TTY bare → usage | ✅ | `cli.ts` + shell entry tests |
| Meta empty argv → `interactive` | ✅ | `meta/veritas.ts` + `meta/veritas.test.ts` |
| Headless one-shot verbs unchanged | ✅ | `cli.test.ts` non-TTY bare → exit 2 |

## Test results

```
cd harness/veritas-example && bun test src/interactive src/cli.test.ts
bun test meta/veritas.test.ts
```

All green in the implementing session (32 + 11 tests).

## Safety review

- Shell wraps ingest/dogma/ControlPlane — does not fork the agent loop (invariant #8).
- `/write` requires dogma required-dimensions PASS before persisting.
- Interactive `/start` wires fail-safe stdin approver (deny on empty/unknown) — invariant #2.
- Non-TTY / CI never auto-enters the REPL (no hang).
