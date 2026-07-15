# DECISIONS

Append-only log of judgment calls for this solo-hackathon kit.

| When (UTC) | Decision | Why |
|---|---|---|
| 2026-07-15T143210Z | Step 1 = problem framing files, not live LLM | Reproducible without API key; ScriptedBackbone proves provenance |
| 2026-07-15T143210Z | Tools = `read_file` only for v1 | Safe-by-construction; matches H-4 generated loadout |
| 2026-07-16T003000Z | Mission objective = *create all hackathon files* | User ask: apply harness mission to materialise the full kit |
| 2026-07-16T003000Z | Kit lives under `hackathon/` | Clear separation from harness spine source |
| 2026-07-16T003000Z | Commit on `test/solo-hackathon-harness` only | Exclude parallel RSI/interactive WIP |
