# Eval: harness-refuter skill

**Plan:** `agents/plans/04-phase-skills-and-consumability.md` §4.3  
**Skill:** `harness/veritas-research/skills/harness-refuter/SKILL.md`  
**Date:** 2026-07-09

## Exercise

INT smoke mission (`bench/int-smoke/mission.json`) contains one confirmed finding after refuter promotion. Offline verification:

```bash
cd harness/veritas-research
bun run verify-finding --fixture bench/int-smoke/mission.json
bun run verify-claims  # int-smoke-confirmed claim
```

## Verification

`bun test src/evidence/refuter.test.ts` green; known-false finding retracted in unit tests.
