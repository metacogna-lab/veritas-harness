# Harness provider guide

Switch LLM provider and model **without changing code**. Configuration lives in
`src/config/`; this guide covers one-off (env) and persistent (`local.json`) selection.

**Default:** `anthropic` / `claude-sonnet-5` via `ANTHROPIC_API_KEY` — not Ollama.

Use `/provider` or `/provider <name>` in Claude Code for a model catalog. Use
`/veritas-config` to generate `src/config/local.json` interactively.

## Providers

| Provider | Label | Auth | Transport |
|----------|-------|------|-----------|
| `anthropic` | Anthropic API (Claude) | `ANTHROPIC_API_KEY` | HTTP |
| `claude-code` | Claude Code CLI | Claude login or `ANTHROPIC_API_KEY` | `claude -p` |
| `openai` | OpenAI API | `OPENAI_API_KEY` | HTTP |
| `codex` | OpenAI Codex CLI | `CODEX_API_KEY` or Codex login | `codex exec` |
| `openrouter` | OpenRouter | `OPENROUTER_API_KEY` | HTTP |
| `ollama` | Ollama (local) | none | HTTP to local Ollama |

Legacy alias: `HARNESS_PROVIDER=local` maps to `ollama`.

### Available models (from registry)

| Provider | Models |
|----------|--------|
| `anthropic` | `claude-sonnet-5`, `claude-opus-4-8`, `claude-haiku-4-5-20251001` |
| `claude-code` | `claude-sonnet-5`, `claude-opus-4-8`, `claude-haiku-4-5-20251001` |
| `openai` | `gpt-4o`, `gpt-4o-mini` |
| `codex` | `o3`, `gpt-4o` |
| `openrouter` | `anthropic/claude-sonnet-5`, `meta-llama/llama-3.1-70b-instruct` |
| `ollama` | `llama3.1`, `qwen2.5`, `qwen3-coder:latest` (or any tag from `ollama list`) |

## One-off selection (environment)

Run from `harness/veritas-research/`:

```bash
# Switch provider for one command
HARNESS_PROVIDER=ollama HARNESS_MODEL=qwen3-coder:latest bun run dev start "objective" --target .

# Switch model only (keeps default provider)
HARNESS_MODEL=claude-opus-4-8 bun run dev start "objective" --target .

# Claude Code CLI for ingest
HARNESS_PROVIDER=claude-code bun run ingest --input ingest/NEW.md

# Codex CLI
HARNESS_PROVIDER=codex bun run dev start --plan missions/example-slug/research-plan.json

# OpenAI API
HARNESS_PROVIDER=openai OPENAI_API_KEY=sk-... bun run dev start ...

# OpenRouter
HARNESS_PROVIDER=openrouter OPENROUTER_API_KEY=sk-or-... bun run dev start ...
```

Set API keys in your shell profile or `.env` (never commit keys).

## Persistent selection (`local.json`)

```bash
cp src/config/local.example.json src/config/local.json
# edit defaultProvider and providers[].model
```

Or run the interactive wizard:

```bash
bun run veritas-config
```

Example — Claude default with Ollama fallback:

```json
{
  "defaultProvider": "anthropic",
  "providers": [
    { "provider": "anthropic", "model": "claude-sonnet-5" },
    { "provider": "ollama", "model": "qwen3-coder:latest", "baseUrl": "http://127.0.0.1:11434/v1" }
  ]
}
```

To make Ollama active: set `"defaultProvider": "ollama"` or `export HARNESS_PROVIDER=ollama`.

## Fallback chain

`providers[]` order is the LLM fallback chain. The entry matching `defaultProvider` is tried
first; others are fallbacks if the primary fails.

## Verify

```bash
bun run doctor
```

Doctor reports active provider, model, and credential/CLI reachability.

## Environment variables

| Variable | Effect |
|----------|--------|
| `HARNESS_PROVIDER` | Active provider id |
| `HARNESS_MODEL` | Override model for active provider |
| `HARNESS_CONFIG` | Path to custom JSON config file |
| `ANTHROPIC_API_KEY` | Anthropic API + Claude Code |
| `OPENAI_API_KEY` | OpenAI API |
| `CODEX_API_KEY` | Codex CLI headless |
| `OPENROUTER_API_KEY` | OpenRouter |

Technical reference: `src/config/README.md` and `src/config/providers.ts`.
