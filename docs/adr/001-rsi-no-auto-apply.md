# ADR 001 — RSI must not auto-apply harness edits

**Status:** Accepted  
**Date:** 2026-07-15  

## Context

Autonomous RSI apply is unauthorized by Plan 08 and invariant #5.

## Decision

RSI may mine, propose, validate, write `loadout-candidate/` artifacts, and emit
review packets. It must not patch tracked source or merge without a human
executing apply steps (`scripts/apply-rsi-release.mjs` prints git instructions only).

## Consequences

Unattended `veritas rsi` fail-safe denies apply. True auto-apply needs a new authorizing plan.
