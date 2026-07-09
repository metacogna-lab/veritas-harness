---
name: harness-provider
description: >-
  Show harness LLM provider info and available models. Use when the user asks to
  "switch provider", "use ollama", "set HARNESS_PROVIDER", "configure claude-code",
  "what models", "/provider", or list provider options. Info-only unless user
  explicitly asks to persist config.
---

# Harness Provider

Show provider and model information. **Do not modify config files unless the user explicitly asks to persist.**

## Steps

1. Read `harness/veritas-research/PROVIDER.md` and `harness/veritas-research/src/config/providers.ts` (`PROVIDER_REGISTRY`, `availableModels`).
2. Parse `$ARGUMENTS` as optional provider id: `anthropic`, `ollama`, `claude-code`, `codex`, `openai`, `openrouter` (`local` → `ollama`).
3. **No argument:** list all providers with label, transport kind, auth env var, and default model.
4. **With argument X:** show that provider's details and a numbered list of `availableModels` from the registry.
5. Present execution options from PROVIDER.md:
   - One-off: `HARNESS_PROVIDER` / `HARNESS_MODEL` env vars
   - Persistent: `src/config/local.json` or `/veritas-config`
6. **Do not write files or change env** unless the user explicitly confirms they want to persist — then offer `/veritas-config` or show the exact `local.json` snippet.

## Hard rules

- Info-only by default — never silently update `local.json` or shell config.
- Model list must come from `PROVIDER_REGISTRY` in `providers.ts`, not invented.
- Default provider is `anthropic`, not Ollama.

## Don't mark done until

The user has seen provider details and execution steps from PROVIDER.md.
