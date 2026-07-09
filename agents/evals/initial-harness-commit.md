# Eval: initial harness commit

**Plan:** `agents/plans/00-overview.md`, `05-verification-and-benchmarks.md`  
**Branch:** `chore/initial-harness-commit`  
**Date:** 2026-07-09

## Verification (canonical tree)

```bash
cd harness/veritas-research
bun test          # 155 pass
bun run doctor    # exit 0
bun run verify-claims  # 3 claims reproduced
bun run bench     # scope-gate exit 0
```

## Delivered

- Full BASIC + INT + ADV + Skills + Consumability under `harness/veritas-research/`
- Agents plans, docs, state, evals committed
- `general-purpose/` duplicate removed
