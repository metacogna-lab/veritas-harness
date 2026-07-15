# veritas-example

Exploratory **spawned** research-domain harness — loadouts, ingest, RSI, bench, and
skills. Prefer this package for running missions. **Harness creation** lives only at
the repo root (`bun run create-harness` / `meta/`); derive a seed spec from a plan via
`src/ingest/to-harness-spec.ts`, then pass it with `--from-spec`.

A Veritas harness — a typed agent loop with safety gates, an evidence ledger, and
a control-plane CLI. Scaffolded from the meta-harness template; extend it by
registering tools and specialists, never by forking the loop (invariant #8).

## The eight planes (see `src/planes.ts`)

| Plane | Module | Role |
|-------|--------|------|
| Provider | `src/llm` | Single `complete()` interface + a scripted backbone for tests |
| Safety | `src/safety` | Pure scope gate; deny off-scope/loopback/private by default |
| Verification | `src/evidence` | Evidence gate — provenance before claim |
| Memory | `src/mission` | Append-only ledger + findings |
| Capability | `src/tools` | Typed, schema-validated, risk-tiered registry |
| Execution | `src/agent` | The ReAct loop under a hard step ceiling |
| Orchestration | `src/orchestration` | Honest decomposition (roadmap) |
| Control | `src/cli` | Mission lifecycle + intake |

## Quick start

```bash
bun install
bun test          # green out of the box (scripted backbone, no network)
bun run dev planes
bun run dev smoke
bun run doctor
```

## Next steps

1. Wire a real provider transport behind `LLMBackbone` (`src/llm/`).
2. Add tools in `src/tools/` (side effects ⇒ at least `active` tier + `scopeTargets`).
3. Add specialists/loadouts and real control-plane verbs (`start`, `status`, `report`).
