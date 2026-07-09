---
name: harness-init
description: >-
  Initialize and verify a fresh Veritas harness installation. Use when the user asks to
  "set up the harness", "initialize", "first-time setup", "get started with Veritas",
  "install the harness", or onboard a new operator. Walks through the full setup sequence
  from clone to first mission.
---

# Harness Init

Walk through the full installation sequence from scratch to a running first mission.

## Steps

### 1. Prerequisites check

Verify required tools are available:

```bash
bun --version          # must be installed
node --version         # 18+
git --version
```

If Bun is missing: `curl -fsSL https://bun.sh/install | bash`

### 2. Clone and enter

```bash
git clone <repo-url> veritas
cd veritas/harness/<harness>
```

### 3. Install dependencies

```bash
bun install
```

### 4. Configure a provider

Use **harness-provider** to browse available providers, then **harness-config** to
persist the choice:

```bash
# Quick start: set the API key for the default Anthropic provider
export ANTHROPIC_API_KEY=sk-ant-...

# Or: run the interactive config wizard
bun run veritas-config
```

### 5. Verify the environment

```bash
bun run doctor
```

Fix any `❌` failures before continuing. `⚠️` warnings (e.g., no key for an unused provider)
are non-blocking.

### 6. Run the test suite

```bash
bun test
```

All 180+ tests must pass. A green suite confirms the install is sound.

### 7. Reproducibility hook (optional)

```bash
git config core.hooksPath .githooks
```

Prevents pushing headline numbers that can't be re-derived from committed artifacts.

### 8. First mission

```bash
# List available loadouts
bun run dev loadouts

# Filesystem audit smoke test
bun run dev start "List top-level files and summarize structure" \
  --loadout codebase-audit \
  --target .

# From an ingested research plan
bun run ingest --input ingest/NEW.md
bun run dev start --plan missions/<slug>/research-plan.json
```

## Composing with other skills

- Use **harness-provider** to understand available LLM backends before step 4.
- Use **harness-config** to persist provider config (step 4 interactive path).
- Use **harness-ingest** to compile a research brief into a mission plan (step 8).
- Use **harness-eval-runner** after the first mission to add a benchmark suite.

## Hard rules

- Never commit `src/config/local.json` — it holds provider overrides and is gitignored.
- Never commit API keys. Keys live in environment variables only.
- Read `harness/INSTALLATION.md` for the full operator reference.

## Don't mark done until

`bun run doctor` and `bun test` both pass, and at least one mission completes (even with
`--max-steps 3` for a smoke test).
