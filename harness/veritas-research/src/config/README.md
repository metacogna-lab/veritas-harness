# Harness model configuration

Provider and model settings live in this directory. The harness defaults to **Anthropic (Claude)** via the HTTP API — not Ollama. Ollama, Claude Code CLI, Codex CLI, and other backends are opt-in.

## Files

| File | Purpose |
|------|---------|
| `default.json` | Committed defaults (`anthropic` / `claude-sonnet-5`) |
| `local.example.json` | Copy to `local.json` to enable extra providers locally |
| `local.json` | Your overrides (gitignored) |
| `providers.ts` | Provider registry — add new backends here |

## Quick selection

### Switch provider (one-off)

```bash
# Anthropic API (default)
export ANTHROPIC_API_KEY=sk-ant-...

# Ollama (local, no key)
HARNESS_PROVIDER=ollama HARNESS_MODEL=qwen3-coder:latest bun run dev start ...

# Claude Code CLI (uses `claude` on PATH + Anthropic auth)
HARNESS_PROVIDER=claude-code bun run ingest --input ingest/NEW.md

# OpenAI Codex CLI (uses `codex` on PATH)
HARNESS_PROVIDER=codex bun run dev start ...

# OpenAI API
HARNESS_PROVIDER=openai OPENAI_API_KEY=sk-... bun run dev start ...

# OpenRouter
HARNESS_PROVIDER=openrouter OPENROUTER_API_KEY=sk-or-... bun run dev start ...
```

### Switch model (one-off)

```bash
HARNESS_MODEL=claude-opus-4-8 bun run dev start "objective" --target .
HARNESS_PROVIDER=ollama HARNESS_MODEL=llama3.1 bun run dev start ...
```

### Persistent config

```bash
cp src/config/local.example.json src/config/local.json
# edit local.json — set defaultProvider and per-provider model/baseUrl
```

Example `local.json` with Ollama as fallback only (Claude stays default):

```json
{
  "defaultProvider": "anthropic",
  "providers": [
    { "provider": "anthropic", "model": "claude-sonnet-5" },
    { "provider": "ollama", "model": "qwen3-coder:latest", "baseUrl": "http://127.0.0.1:11434/v1" }
  ]
}
```

To make Ollama the active provider, set `"defaultProvider": "ollama"` or export `HARNESS_PROVIDER=ollama`.

## Environment variables

| Variable | Effect |
|----------|--------|
| `HARNESS_PROVIDER` | Active provider (`anthropic`, `claude-code`, `codex`, `ollama`, `openai`, `openrouter`) |
| `HARNESS_MODEL` | Override model for the active provider |
| `HARNESS_CONFIG` | Path to a custom JSON config file |
| `ANTHROPIC_API_KEY` | Anthropic API + Claude Code CLI |
| `OPENAI_API_KEY` | OpenAI API |
| `CODEX_API_KEY` | Codex CLI headless runs |
| `OPENROUTER_API_KEY` | OpenRouter |

Legacy alias: `HARNESS_PROVIDER=local` is accepted and maps to `ollama`.

## Provider reference

| Provider | Transport | Auth | Native tool calling |
|----------|-----------|------|---------------------|
| `anthropic` | HTTP Messages API | `ANTHROPIC_API_KEY` | yes |
| `claude-code` | `claude -p` subprocess | Claude login or `ANTHROPIC_API_KEY` | no (text shim) |
| `openai` | HTTP Chat Completions | `OPENAI_API_KEY` | yes |
| `codex` | `codex exec` subprocess | `CODEX_API_KEY` or Codex login | no (text shim) |
| `openrouter` | HTTP OpenAI-compatible | `OPENROUTER_API_KEY` | yes |
| `ollama` | HTTP OpenAI-compatible | none (local) | no (text shim) |

## Fallback chain

`providers[]` order defines the LLM fallback chain. The entry matching `defaultProvider` is tried first; remaining entries are fallbacks if the primary fails.

## Adding a provider

1. Add an entry to `PROVIDER_REGISTRY` in `providers.ts`.
2. Wire transport routing in `src/llm/transports.ts` (HTTP or CLI).
3. Add tests in `src/config/index.test.ts`.
4. Document in this file and `local.example.json`.
