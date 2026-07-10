# Example: initialization and use

This walkthrough takes you from a fresh clone to a completed mission. It uses the existing `veritas-research` harness. If you need to create a new harness first, read [01-create.md](01-create.md).

## Initialize

```bash
git clone <repo-url> veritas
cd veritas/harness/veritas-research
bun install
bun run doctor
bun test
```

Set a provider before any live LLM call. Pick one path below. Both run the same mission afterward.

**Path A: Claude Code**

```bash
npm install -g @anthropic-ai/claude-code
export ANTHROPIC_API_KEY=sk-ant-...    # or use claude login
export HARNESS_PROVIDER=claude-code
```

**Path B: Ollama Hermes3**

```bash
ollama pull hermes3
ollama serve                           # keep running in another terminal
export HARNESS_PROVIDER=ollama
export HARNESS_MODEL=hermes3
```

Re-run doctor with your provider active:

```bash
bun run doctor
```

## Prepare a research brief

Copy the committed example and edit if you like:

```bash
cp ingest/examples/scope-gate-study.NEW.md ingest/NEW.md
```

Compile it into a validated plan:

```bash
bun run ingest --input ingest/NEW.md
# ingest: wrote missions/scope-gate-study/research-plan.json
```

Check the plan against the research dogma gate:

```bash
bun run dev eval --plan missions/scope-gate-study/research-plan.json
```

If required dimensions fail, fix `ingest/NEW.md` and re-run ingest.

## Run the mission

```bash
bun run dev start --plan missions/scope-gate-study/research-plan.json
```

Eval and source digest run automatically before the agent loop unless you pass `--skip-digest`. Output streams to the terminal. When it finishes:

```bash
bun run dev status <mission-id>
bun run dev report <mission-id>
```

The report lists proposed and confirmed findings backed by tool observations in the mission log.

## Optional next steps

Digest sources into summaries organized by idea:

```bash
bun run dev digest --plan missions/scope-gate-study/research-plan.json
```

Run the refuter against a committed finding fixture:

```bash
bun run verify-finding --fixture bench/int-smoke/mission.json
```

Run the scope-gate benchmark and verify headline numbers:

```bash
bun run bench scope-gate
bun run verify-claims
```

For a deeper tour of eval, digest, bench, and extension, see `harness/veritas-research/EXAMPLE.md`.

## What you just did

You initialized a harness, chose an LLM backend (cloud CLI or local Hermes3), compiled human intent into a plan, validated it, and ran a scoped agent loop where every claim must trace to a tool observation. The harness separates judgment (the model) from discipline (scope, evidence, refuter). These steps are the minimum path to see that separation work.

Read the four parts in order for the concepts behind each step: [README.md](README.md).
