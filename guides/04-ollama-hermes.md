# Part 4: Ollama Hermes3 as provider

Ollama runs models locally over HTTP. Hermes3 (`hermes3`) is a capable general model for scoped filesystem work. The harness talks to Ollama through an OpenAI-compatible endpoint at `http://127.0.0.1:11434/v1`.

## Prerequisites

Install Ollama from https://ollama.com. Pull the model and keep the server running:

```bash
ollama pull hermes3
ollama serve
```

`hermes3` is not listed in the committed model catalog (`llama3.1`, `qwen2.5`, `qwen3-coder:latest` are). Ollama accepts any pulled tag via `HARNESS_MODEL`. This works; it is just not enumerated in `providers.ts`.

## Run with Hermes3

From `harness/veritas-research/` (or your harness):

```bash
HARNESS_PROVIDER=ollama HARNESS_MODEL=hermes3 bun run doctor
```

`doctor` does not ping Ollama. If a mission fails with connection errors, start `ollama serve`.

Run a scoped mission:

```bash
HARNESS_PROVIDER=ollama HARNESS_MODEL=hermes3 bun run dev start \
  "Summarise src/safety/scope.ts" \
  --loadout codebase-audit \
  --target src/safety \
  --max-steps 8
```

For ingest and plan-driven missions, prefix the same env vars:

```bash
HARNESS_PROVIDER=ollama HARNESS_MODEL=hermes3 bun run ingest --input ingest/NEW.md
HARNESS_PROVIDER=ollama HARNESS_MODEL=hermes3 bun run dev start \
  --plan missions/<slug>/research-plan.json
```

Legacy alias: `HARNESS_PROVIDER=local` maps to `ollama`.

## What to expect

Like Claude Code, Ollama uses the text JSON shim (`nativeToolCalling: false`). Local models are slower and less reliable on multi-tool loops than cloud APIs. Raise `--max-steps` for complex objectives. Keep scope tight.

Hermes3 on Ollama gives you a fully local path with no API key. Useful for scoped filesystem missions and offline iteration while the harness discipline stays the same.

Next: [EXAMPLE.md](EXAMPLE.md) for initialization and use end to end.
