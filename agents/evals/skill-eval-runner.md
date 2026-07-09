# Eval: harness-eval-runner skill

**Plan:** `agents/plans/04-phase-skills-and-consumability.md` §4.2  
**Skill:** `harness/veritas-research/skills/harness-eval-runner/SKILL.md`  
**Date:** 2026-07-09

## Exercise

Ran `scope-gate` suite per skill steps:

```bash
cd harness/veritas-research
bun run bench scope-gate
bun run verify-claims
```

Committed `bench/scope-gate/results.json` and `bench_pass_at_1` claims (black + white separate).

## Verification

All 3 claims reproduce from committed artifacts (Unit 2).
