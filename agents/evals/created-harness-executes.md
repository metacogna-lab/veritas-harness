# Eval: a meta-harness-created harness actually executes (PLAN-MASTER §8)

**Date:** 2026-07-17
**Method:** `bun run create-harness demo-smoke-test --capabilities starter`, then independently
re-verified build/test/doctor/CLI against the output (not just trusting the pipeline's own
internal `bun test` step). Harness deleted and deregistered after verification — this was a
smoke test, not a product addition.

## Result: PASS, with one concrete gap identified

The pipeline itself (`meta/create-harness.ts`) ran its 7 steps — validate, scaffold, capability
install, manifest, register, `bun install`, `bun test` — and all 7 succeeded, including its own
`bun test` gate.

Independent re-verification in the created harness:

| Check | Result |
|---|---|
| `bun run build` (tsc) | clean, exit 0 |
| `bun test` | 12/12 pass |
| `bun run doctor` | environment OK (only the expected no-API-key warning) |
| `bun run veritas-config` | resolves `../../base-scripts/veritas-config.mjs` correctly, prints provider menu |
| `bunx tsx src/cli.ts planes` | prints the 8-plane table correctly |

### Safety invariants proven end-to-end (via the harness's own committed `src/spine.test.ts`)

- **Invariant #1 (scope before action):** an in-scope `read_file` call succeeds and is logged;
  an out-of-scope call (`/etc/passwd`) is denied by the gate with `SCOPE DENIED`, never executed.
- **Invariant #3 (provenance before claim):** a finding backed by a real tool observation is
  accepted; one with no backing observation is rejected.

### Gap found: no CLI verb runs a mission

`src/cli.ts` in the current template (`meta/templates/harness-template/`) implements exactly one
verb — `planes` (prints the 8-plane table). There is no `start`/`status`/`report` verb wired, so
"the harness executes for its goal" is currently provable only via the committed unit test
(`spine.test.ts` driving `runAgent()` in-process), not via the actual command line a human or
another agent would use. `veritas-research`/`veritas-example` both have full `start`/`status`/
`report` CLIs (`src/cli.ts` in each, ~200+ lines) — this capability exists in the migrated
harnesses but was never ported back into the template.

**Invariants #2 (fail-safe deny), #4 (refute before confirm), #5 (human before consequence) were
not exercised** — the `starter` capability pack ships only inert `safe`-tier tools (`read_file`)
by design (BASIC tier, per `CLAUDE.md`'s build order), so there is no intrusive/dangerous/
credential-tier tool call to gate. Exercising those requires a capability pack beyond `starter`
(e.g. wiring a real `research`-pack tool), which is out of scope for a BASIC-tier smoke test.

## Follow-up

Tracked under `PLAN-MASTER-META-HARNESS.md` §3.3/§4: the template needs a real mission-execution
CLI (ported from `veritas-research`'s, which is already spine-compatible) before "created harness
executes for its goal" is true at more than the BASIC/unit-test level.
