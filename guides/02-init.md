# Part 2: Initialize a harness

You have a harness directory. Now make it runnable. This part is provider-agnostic. Parts 3 and 4 cover Claude Code and Ollama Hermes3.

## Steps

Enter the harness and install dependencies:

```bash
cd harness/veritas-research   # or harness/<your-name>
bun install
```

The default LLM provider is Anthropic over HTTP. Set a key before your first live mission:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

You can persist provider settings later in `src/config/local.json`. See [PROVIDER.md](../harness/veritas-research/PROVIDER.md) when you are ready.

Verify the environment:

```bash
bun run doctor
bun test
```

Fix any hard failures from `doctor` before continuing. Warnings about unused providers are fine. All tests should pass.

List what the harness can do:

```bash
bun run dev loadouts
```

Run a short smoke mission on the filesystem:

```bash
bun run dev start "List top-level files" \
  --loadout codebase-audit \
  --target . \
  --max-steps 5

bun run dev status <mission-id>
```

The agent proposes actions, passes them through the scope gate, executes tools, and observes results until it records a finding or hits the step limit. Mission artifacts land under `.veritas/runs/<id>/`.

`doctor` and a green test suite mean the loop and gates are wired before you spend tokens on a real objective.

Next: [03-claude-code.md](03-claude-code.md) or [04-ollama-hermes.md](04-ollama-hermes.md).
