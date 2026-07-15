# Harness installation

This directory holds **spawned harness packages** — typed agent loops with safety gates,
evidence tracking, and a control-plane CLI. Each subdirectory is an independent exploratory
package (`package.json`, toolchain, tests). **Harness creation** (scaffold / register / capability
packs) lives only at the repo root via `bun run create-harness` — never inside these folders.

| Harness | Purpose |
|---------|---------|
| [`veritas-research/`](veritas-research/) | Exploratory reference of the rich 8-plane spine (no domain loadouts). Scaffold *source of truth* is `meta/templates/harness-template/`. |
| [`veritas-example/`](veritas-example/) | Research-domain reference — loadouts, ingest, RSI, bench, skills. Prefer this for running missions. |

Follow the steps below for any harness under `harness/`. Paths are relative to that harness's
root (e.g. `harness/veritas-example/`).

---

## 1. Prerequisites

Install these once on your machine:

| Tool | Minimum | Notes |
|------|---------|-------|
| [Bun](https://bun.sh) | latest stable | Runtime and package manager for all harness commands |
| Node.js | 18+ | Required by some global CLIs; `doctor` checks this |
| `git` | any recent | On `PATH`; used by missions and optional pre-push hook |

Optional global tools (only if you select that provider — see step 4):

```bash
# Claude Code CLI — for HARNESS_PROVIDER=claude-code
npm install -g @anthropic-ai/claude-code

# Ollama — for HARNESS_PROVIDER=ollama (install from https://ollama.com)
ollama pull qwen3-coder:latest   # or your chosen model
```

---

## 2. Clone and enter the harness

```bash
git clone <repo-url> veritas
cd veritas/harness/veritas-example
```

Replace `veritas-example` with `veritas-research` (spine-only) or another `harness/<name>/` you
created with `bun run create-harness`.

---

## 3. Install dependencies

From the harness root:

```bash
bun install
```

This installs TypeScript, `tsx`, `zod`, and test tooling declared in `package.json`.

---

## 4. Configure the LLM provider

Default provider is **Anthropic (Claude API)** via `src/config/default.json`. You need an API key
for the default path:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### Persistent overrides (recommended)

```bash
cp src/config/local.example.json src/config/local.json
# edit local.json — defaultProvider, models, fallback chain
```

`local.json` is gitignored. See [`veritas-example/src/config/README.md`](veritas-example/src/config/README.md)
for the full provider table (`anthropic`, `claude-code`, `codex`, `ollama`, `openai`, `openrouter`).

### One-off provider switch

```bash
HARNESS_PROVIDER=ollama HARNESS_MODEL=qwen3-coder:latest bun run dev start "smoke test" --target .
HARNESS_PROVIDER=claude-code bun run ingest --input ingest/NEW.md
```

Environment variables are documented in the config README. Secrets are resolved from the
environment and redacted before logging — never commit keys into `local.json` if the file is
tracked.

---

## 5. Verify the environment

```bash
bun run doctor
```

`doctor` checks Bun/Node versions, config load, secret redaction, provider credentials or CLI
binaries on `PATH`, and required tools. Fix any `❌` failures before starting a mission.

---

## 6. Run the test suite

```bash
bun test
```

All harness modules ship co-located `*.test.ts` files. A green suite confirms the install is
sound before you run live LLM missions.

---

## 7. Optional: reproducibility pre-push hook

From the harness root, wire the committed hook so headline numbers cannot push without
re-derivation:

```bash
git config core.hooksPath .githooks
```

The hook runs `bun run verify-claims` on `git push`. Skip this for read-only clones.

---

## 8. First mission (smoke test)

List available loadouts:

```bash
bun run dev loadouts
```

Start a scoped mission (filesystem audit example):

```bash
bun run dev start "List top-level files and summarize structure" \
  --loadout codebase-audit \
  --target .
```

Check status and report:

```bash
bun run dev status <mission-id>
bun run dev report <mission-id>
```

Mission artifacts land under `.veritas/runs/` (override with `VERITAS_RUNS_DIR`).

### From an ingested research plan

Compile a brief, then start from the plan:

```bash
bun run ingest --input ingest/NEW.md
bun run dev start --plan missions/<slug>/research-plan.json
```

---

## 9. Day-to-day commands

All commands run from the harness root:

| Command | Purpose |
|---------|---------|
| `bun run dev` | Harness CLI (`start`, `status`, `report`, `ingest`, `loadouts`) |
| `bun run build` | TypeScript compile (`tsc`) |
| `bun run doctor` | Environment healthcheck |
| `bun run verify-claims` | Re-derive committed headline numbers |
| `bun run verify-finding` | Run the refuter against a finding |
| `bun run bench` | Committed-oracle benchmark suites |
| `bun run lessons` | Record/retrieve mission lessons |

Operator docs for agents working in this repo: [`../CLAUDE.md`](../CLAUDE.md).

---

## Adding another harness type

New capability domains belong under `harness/<name>/` as a sibling package. **Do not
hand-create the folder** — the meta-harness root owns an ordered pipeline that
scaffolds it and keeps the registry, manifest, and 1-based index consistent
(invariant #4). From the repo root:

```bash
bun run create-harness <name> [--capabilities a,b] [--from-spec path/to/spec.json]
bun run list-harnesses
bun run harness-doctor
```

`--from-spec` consumes a `HarnessSpec` JSON (H-4; see `meta/harness-spec.ts` and
`agents/specs/`). Domain harnesses can derive a spec from an ingested plan via
`harness/veritas-example/src/ingest/to-harness-spec.ts` — they do not run the scaffold themselves.

The pipeline progresses in order: validate → scaffold the 8-plane template →
install capability-pack skills into `harness/<name>/skills/` → write `harness.json`
→ register in `harnesses.json` → `bun install` → `bun test`. Then:

1. Wire a real provider behind `LLMBackbone` and register the first tool (the
   installed **harness-first-tool** skill walks through this).
2. Add loadouts by composing against the same loop — never fork it (invariant #8).
3. Document harness-specific provider/scope needs in that package's `README.md`.
4. Add a row to the table at the top of this file.

Generic operating skills (init, provider, config, tool-adder, refuter, eval-runner)
live at the meta root under `skills/` and operate any harness; harness-specific
skills are the ones the pipeline installs into `harness/<name>/skills/`.
