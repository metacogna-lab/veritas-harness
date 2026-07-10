# Part 3: Claude Code as provider

Claude Code here means the `claude` CLI on your PATH, invoked by the harness as a subprocess (`claude -p`). It is not the interactive Claude Code IDE session. The harness sets `HARNESS_PROVIDER=claude-code` and routes completions through that binary.

## Prerequisites

Install the CLI globally (Node 18+):

```bash
npm install -g @anthropic-ai/claude-code
claude --version
```

Authenticate with `ANTHROPIC_API_KEY` or the Claude login flow that `claude` expects.

## Run with Claude Code

From `harness/veritas-research/` (or your harness):

```bash
HARNESS_PROVIDER=claude-code bun run doctor
```

`doctor` should find `claude` on PATH. A credential warning is fine if you logged in interactively.

Ingest a research brief:

```bash
HARNESS_PROVIDER=claude-code bun run ingest --input ingest/NEW.md
```

Start a mission from the plan:

```bash
HARNESS_PROVIDER=claude-code bun run dev start \
  --plan missions/<slug>/research-plan.json
```

Or a direct mission:

```bash
HARNESS_PROVIDER=claude-code bun run dev start \
  "Summarise src/safety/scope.ts" \
  --loadout codebase-audit \
  --target src/safety \
  --max-steps 8
```

## What to expect

The registry marks `claude-code` with `nativeToolCalling: false`. The harness injects a text JSON shim: the model emits `{"tool":"<name>","input":{...}}` instead of native function calls. Tool-heavy missions may need a higher `--max-steps`.

Claude Code lets you run missions on your existing Anthropic auth without wiring HTTP API calls yourself. The harness still owns scope, evidence, and the refuter. The model supplies judgment inside that frame.

Next: [04-ollama-hermes.md](04-ollama-hermes.md) for a fully local path, or [EXAMPLE.md](EXAMPLE.md) for the full walkthrough.
