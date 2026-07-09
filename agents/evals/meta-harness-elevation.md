# Eval — meta-harness elevation + eight-plane/RSI foundation

**Date:** 2026-07-09  **Scope:** root meta-harness, create-harness pipeline, skill
reclassification, lessons feedback, eight-plane formalization, human-gated RSI skeleton.

## Definition of done → evidence

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Root is a meta-harness owning all harnesses | ✅ | `meta/`, `harnesses.json`, `bun run list-harnesses` shows #1 |
| Harnesses concretely separated | ✅ | independent packages under `harness/<name>/`; template spine |
| New harness init progresses in order into `harness/` (#4) | ✅ | `create-harness.ts` 7 ordered stages; E2E scaffold `bun test` green |
| Each harness (incl. veritas-research #1) through the pipeline | ✅ | `harness.json` manifests; registry; veritas-research conformed non-destructively |
| Skills for the harness system, not one harness (#3) | ✅ | generic skills at root `skills/`; research skills as capability pack + in-harness |
| New harness skills initialized at run time | ✅ | capability packs copied into `harness/<name>/skills/` by pipeline |
| Outstanding documented work built | ✅ (partial by design) | lessons→planning feedback (opt-in); HTTP server deferred by decision |
| Eight-plane architecture formalized | ✅ | `src/planes.ts` + drift test; plan 08; ephemeral `context-window` |
| RSI loop (human-gated) | ✅ | `src/rsi/*`; apply stops at `requireHumanRelease`; 11 tests |

## Test results

- Meta suite: 30 pass / 0 fail.
- veritas-research suite: 218 pass / 0 fail (was 196 pre-work; +22 from new tests).
- verify-claims: 3/3 reproduced. harness-doctor: healthy.

## Safety review

- RSI self-edit path is human-gated and fail-safe deny when unattended; ineligible
  proposals never offered; proposer context honest + bounded. No autonomous self-modification.
- Scaffolder wires the same scope/evidence gates into every new harness (compose, don't fork).

## Follow-ups

- `fix/source-digest-types`: 8 pre-existing tsc errors in `source-digest.ts` (unrelated).
- Optional: HTTP control-plane server if remote access is needed.
- Roadmap: wire a real proposer model + sandbox runner behind the RSI dry-run (human-authorized).
