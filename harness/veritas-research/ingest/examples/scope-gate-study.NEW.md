---
title: "Benchmark scope-gate under adversarial hosts"
slug: scope-gate-study
author: operator
created: 2026-07-09
loadout_hint: research
target_hint: bench/scope-gate
priority: normal
sources:
  - agents/docs/processed/strategy.md
---

## Question
What is the measurable pass@1 for the scope-gate benchmark in black-box mode?

## Scope
In: bench/scope-gate, src/safety/scope.ts
Out: production deployments, live network beyond localhost

## Success criteria
- Reproducible pass@1 via verify-claims
- At least one confirmed finding with provenance

## Constraints
- No dangerous-tier tools
- Honest decomposition only (invariant 7)
