---
name: harness-refuter
description: >-
  Verify a finding before reporting it as confirmed. Use when the user asks to
  "verify this finding", "is this real", "confirm before reporting", run the
  refuter, or promote/retract a finding using committed evidence only.
---

# Harness Refuter

A finding is not confirmed until a separate model instance fails to disprove it using only committed evidence.

## Steps

1. Load the finding and its provenance from the mission log (`Mission.snapshot()` or `bench/int-smoke/mission.json`).
2. Confirm the finding passed `evidenceGate` (provenance: `toolName` + `observationSeq` matches a successful observation in the transcript). Reject fabricated findings with no matching observation.
3. Run the refuter — a **different** model instance or temperature than the one that produced the finding:
   - CLI: `bun run verify-finding --fixture <path>` for offline committed artifacts
   - Programmatic: `promoteFinding()` in `src/evidence/refuter.ts`
4. The refuter is prompted to **DISPROVE** the claim using ONLY committed evidence.
5. Outcomes:
   - Survives refutation → `confirmed` (log refuter reason)
   - Fails refutation → `retracted` (log refuter reason alongside finding)
   - Unparseable refuter verdict → `retracted` (fail-safe)
6. **Never** report a finding as confirmed if:
   - It lacks provenance (`evidenceGate` rejected it), or
   - It was retracted by the refuter

## Invariants

- Refute before confirm (invariant #4)
- Provenance before claim (invariant #3)
- Reproduce before report — headline confirmed counts must re-derive via `bun run verify-claims`

## Don't mark done until

Refuter tests pass (`bun test src/evidence/refuter.test.ts`) and, for a live mission, `verify-finding` / `promoteFinding` outcome matches the committed artifact in `claims.json`.
