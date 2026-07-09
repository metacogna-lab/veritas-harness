---
name: harness-veritas-config
description: >-
  Launch interactive harness configuration to generate src/config/local.json.
  Use when the user asks to "configure harness", "set up provider", "veritas config",
  "generate local.json", "persist provider settings", or run /veritas-config.
---

# Veritas Config Wizard

Generate `src/config/local.json` through an interactive flow.

## Steps

1. Read `harness/veritas-research/PROVIDER.md` and `src/config/providers.ts` for provider/model
   options. If the user wants to browse providers first, use **harness-provider**.
2. Use **AskQuestion** (or equivalent) for each step:
   - **Default provider** — recommend `anthropic`; options from `PROVIDER_REGISTRY`
   - **Model** — show `availableModels` for chosen provider; allow custom string (Ollama tags)
   - **Fallback providers** — optional multi-select (e.g. `anthropic` then `ollama`)
   - **Ollama baseUrl** — only if `ollama` is in the chain (default `http://127.0.0.1:11434/v1`)
3. **Preview** — show JSON before writing.
4. **Confirm** — only write after user approves.
5. **Write** `harness/veritas-research/src/config/local.json` (gitignored).
6. **Verify** — run `bun run doctor` from `harness/veritas-research/`.

### Terminal fallback

In terminal-only contexts (no AskQuestion), run:

```bash
cd harness/veritas-research
bun run veritas-config
```

## Generated shape

```json
{
  "defaultProvider": "anthropic",
  "providers": [
    { "provider": "anthropic", "model": "claude-sonnet-5" },
    { "provider": "ollama", "model": "qwen3-coder:latest", "baseUrl": "http://127.0.0.1:11434/v1" }
  ]
}
```

## Composing with other skills

- Use **harness-provider** first if the user isn't sure which provider they want.
- After generating `local.json`, **harness-ingest** and missions will automatically pick up the
  new provider from config.

## Hard rules

- Never commit `local.json` — it is gitignored.
- Never store API keys in `local.json`; use environment variables for secrets.
- Model names must align with `PROVIDER_REGISTRY` defaults or user-specified custom tags.

## Don't mark done until

`local.json` is written (or user declined) and `bun run doctor` passes.
