# Eval: ingest workflow

**Plan:** `agents/plans/07-phase-ingest.md`  
**Skill:** `harness/veritas-research/skills/harness-ingest/SKILL.md`  
**Date:** 2026-07-09

## Exercise

Implemented the full ingest add-on:

- `src/ingest/` pipeline with sanitize, parse, catalog, LLM fitter, Zod validation
- Golden fixture at `harness/veritas-research/missions/example-slug/research-plan.json`
- `research` loadout + `veritas start --plan` consumption path

## Verification

```bash
cd harness/veritas-research && bun test
bun run doctor
```

Results: all tests green in single harness package.

Mock-LLM integration test (`src/ingest/ingest.test.ts`) validates end-to-end fit without API keys.

## Consumption smoke

```bash
cd harness/veritas-research
bun run dev start --plan missions/example-slug/research-plan.json --max-steps 1
```

Requires a configured provider for live LLM; plan loading and control-plane wiring verified by unit tests.
