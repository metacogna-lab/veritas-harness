# Veritas CLI Reference

A phased reference from zero to running mission. All commands are for `harness/veritas-example/` unless noted. Run meta-harness commands from the repo root.

---

## Quick Start

Five commands from a fresh clone to a completed mission:

```bash
# 1. Install dependencies (repo root, then harness)
bun install && cd harness/veritas-example && bun install

# 2. Configure provider (writes src/config/local.json)
bun run veritas-config

# 3. Compile a research plan
bun run ingest -s my-mission -o "Audit the authentication flow and verify at least 3 attack surfaces" -t .

# 4. Run the mission
bun run dev start --plan missions/my-mission/research-plan.json

# 5. Read the report
bun run dev report <mission-id>
```

---

## Repo Layout

```
veritas/                        ← meta-harness root (bun install here first)
  harness/veritas-example/      ← runnable research domain harness
  harness/veritas-research/     ← pure 8-plane template (reference; extend, don't run)
  base-scripts/                 ← shared scripts: doctor, veritas-config, lib/stats
  app/                          ← UI placeholder
  agents/plans/                 ← build plans and architecture documents
```

---

## Meta-Harness Commands

Run from repo root (`/path/to/veritas/`).

```bash
bun run list-harnesses                              # show registry (harnesses.json)
bun run harness-doctor                              # health-check the meta pipeline
bun test meta                                       # run meta-harness unit tests
```

### Spawning a New Harness

```bash
bun run create-harness <name> [--capabilities a,b]
```

The pipeline runs 7 ordered stages — all must pass before the harness is usable:

| Stage | What happens |
|-------|-------------|
| 1 — validate | Kebab-case name check; confirms not already registered; verifies `harness/<name>/` is free |
| 2 — scaffold | Copies `meta/templates/harness-template/` into `harness/<name>/`, token-substituting `__HARNESS_NAME__` |
| 3 — capabilities | Installs selected capability-pack skills from `meta/templates/skills/<pack>/` into `harness/<name>/skills/` |
| 4 — manifest | Writes `harness/<name>/harness.json` with index, planes, capabilities, skills |
| 5 — register | Appends an entry to `harnesses.json` with a 1-based index |
| 6 — install | Runs `bun install` inside the new harness |
| 7 — test | Runs `bun test` inside the new harness — must be green |

```bash
# Example: new harness with the research capability pack
bun run create-harness my-project --capabilities research

# List available capability packs (shown when name is omitted)
bun run create-harness
```

> New harnesses reference shared scripts via `../../base-scripts/`. No local copies of `doctor.mjs` or `veritas-config.mjs` are scaffolded — they inherit from `base-scripts/` automatically.

---

## Harness Setup

Run from `harness/veritas-example/` (or any harness dir).

```bash
bun install            # install deps
bun run build          # tsc — must exit 0 before running missions
bun run doctor         # environment health check (provider key, Bun version, PATH)
bun run veritas-config # interactive wizard → writes src/config/local.json
```

**`bun run doctor`** checks: Bun runtime version, Node ≥ 18, config loads cleanly, no secret leak in redacted config, active provider key or CLI binary, `git` on PATH. Exits 0 if healthy, 1 on hard failures.

**`bun run veritas-config`** presents a numbered provider menu, writes `src/config/local.json` (gitignored). Run once after cloning or when switching providers.

---

## Provider Selection

### One-off (env vars, not persisted)

```bash
ANTHROPIC_API_KEY=sk-ant-...        bun run dev start ...
HARNESS_PROVIDER=ollama HARNESS_MODEL=qwen3-coder:latest  bun run dev start ...
HARNESS_PROVIDER=claude-code        bun run dev start ...   # uses active `claude` CLI session — no key needed
HARNESS_PROVIDER=codex              bun run dev start ...   # uses `codex` CLI on PATH
HARNESS_MODEL=claude-opus-4-8       bun run dev start ...   # override model only
```

### Persistent (local.json)

```bash
bun run veritas-config              # interactive wizard
# or manually: cp src/config/local.example.json src/config/local.json
```

`local.json` is merged over `default.json` at runtime. Structure:

```json
{
  "defaultProvider": "anthropic",
  "providers": [
    { "provider": "anthropic", "model": "claude-sonnet-4-6" },
    { "provider": "ollama",    "model": "qwen3-coder:latest", "baseUrl": "http://127.0.0.1:11434/v1" }
  ]
}
```

Providers are tried in order; first success wins.

---

## Phase 0 — Ingest

Compile a `research-plan.json` from a research brief. The banner prints in interactive/TTY mode; suppressed in `--json` and headless modes.

```bash
bun run ingest [options]
```

| Flag | Short | Description |
|------|-------|-------------|
| `--interactive` | `-i` | Force interactive interview mode (TTY required) |
| `--slug <string>` | `-s` | Mission identifier, e.g. `auth-audit` |
| `--objective <str>` | `-o` | Mission objective (required in headless mode) |
| `--target <path>` | `-t` | Authorized scope boundary / target path |
| `--files <paths>` | `-f` | Comma-separated list of `.md`/`.pdf` files to stage |
| `--dir <path>` | `-d` | Batch-scan a directory; stage all `.md`/`.pdf`/`.txt` files |
| `--json` | — | Suppress prose; emit `{ ok, planPath, slug }` to stdout |
| `--help` | `-h` | Print help and exit |

### Modes

**Interactive** (human at a TTY — no required flags):
```bash
bun run ingest
bun run ingest -i                         # force interactive even if flags present
```
Prompts for slug, objective, target, and optionally a context directory.

**Headless** (agent/CI — required flags: `--slug` + `--objective`):
```bash
bun run ingest -s auth-audit -o "Audit the auth flow and verify at least 2 bypass vectors" -t ./src
bun run ingest -s auth-audit -o "..." --json   # one-line JSON result to stdout
```

Non-TTY without required flags → stderr error + exit 1 (never hangs).

**Directory batch** (required: `--slug` + `--dir`):
```bash
bun run ingest -s threat-model -d /path/to/security/docs
bun run ingest -s threat-model -d ./research/raw --json
```
Walks the directory, symlinks `.md`/`.pdf`/`.txt` files into `research/raw/<slug>/` (idempotent; existing symlinks are skipped). Synthesises a plan from the staged files.

### Output
- Writes `missions/<slug>/research-plan.json`
- Automatically runs the Dogma Gate after writing
- Dogma Gate fail → plan file deleted + exit 1
- `--json` stdout: `{"ok":true,"planPath":"missions/...","slug":"..."}` or `{"ok":false,"error":"..."}`

> The legacy path `bun run dev ingest --input <NEW.md>` still works for hand-written NEW.md files.

---

## Phase 1 — Dogma Gate (Eval)

Validate a plan against research quality standards before execution.

```bash
bun run dev eval --plan missions/<slug>/research-plan.json
```

Exit 0 = pass. Exit 1 = fail with dimension report.

The gate runs automatically at the end of `bun run ingest`. Run manually to re-check an existing plan or after hand-editing.

### Dimensions checked

| ID | Required | What it checks |
|----|----------|----------------|
| `falsifiable-question` | **yes** | Objective ≥ 25 chars; not a vague verb phrase |
| `bounded-scope` | **yes** | `scope.paths` or `scope.hosts` is non-empty |
| `phased-approach` | **yes** | At least 2 phases defined |
| `measurable-success` | **yes** | At least one criterion contains `verify`, `confirm`, `reproduce`, `at least N`, `percent`, etc. |
| `honest-decomposition` | **yes** | Phase descriptions contain no language suggesting hidden intent (invariant 7) |
| `source-grounded` | advisory | At least one source declared |
| `specialist-alignment` | advisory | Each specialist focus ≥ 10 chars |
| `reproducible-criteria` | advisory | No success criterion relies solely on model self-report |

Required dimensions block execution. Advisory dimensions warn but do not block.

Override specific dimensions in `src/config/local.json`:
```json
{ "dogma": { "overrides": { "source-grounded": { "required": true } } } }
```

---

## Phase 2 — Source Digest

Fetch, summarise, and synthesise the sources listed in the plan before the agent runs.

```bash
bun run dev digest --plan missions/<slug>/research-plan.json
bun run dev digest --plan missions/<slug>/research-plan.json --force   # re-digest even if cached
```

Writes per-source summaries to `missions/<slug>/sources/` and a synthesis to `missions/<slug>/synthesis.md`. The `start` verb runs digest automatically unless `--skip-digest` is passed.

---

## Phase 3 — Mission Execution

### Start a mission

```bash
# From an ingested plan (recommended)
bun run dev start --plan missions/<slug>/research-plan.json

# Ad-hoc (plan inferred at start time — no ingest step)
bun run dev start "<objective>" --target <path>
bun run dev start "<objective>" --target <path> --loadout research --max-steps 40
```

| Flag | Description |
|------|-------------|
| `--plan <path>` | Path to `research-plan.json` |
| `--target <path>` | Scope boundary (required if no plan) |
| `--loadout <name>` | Loadout to use (`research`, `codebase-audit`, `web-recon`) |
| `--role <role>` | Override specialist role |
| `--max-steps <n>` | Cap the ReAct loop at N steps |
| `--skip-digest` | Skip source digest phase |
| `--pre-auth <tiers>` | Pre-authorise comma-separated tool tiers (e.g. `active`) |

The banner prints when stdout is a TTY. Each step is streamed to stdout as it executes.

### During execution

```bash
bun run dev status <mission-id>     # current step, findings count, status
bun run dev report <mission-id>     # full findings report
```

### List loadouts

```bash
bun run dev loadouts
```

Prints each registered loadout with name and description. Default loadouts: `research`, `codebase-audit`, `web-recon`.

---

## Phase 4 — RSI (Recursive Self-Improvement)

**Dry-run only.** The apply stage always stops at `requireHumanRelease` — no edits are ever applied automatically.

```bash
bun run dev rsi
```

### How it works

```
mine      Read mission transcripts + findings from resources/experience/
           → cluster failures by pattern (scope denials, parse errors, refuter rejections)

propose   For each failure cluster, generate 2–3 minimal candidate harness edits
           as diffs targeting src/agent/specialists.ts, src/tools/, src/safety/scope.ts

validate  Run the Dogma Gate and benchmark suite against each candidate
           → score: promote / hold / reject

release   requireHumanRelease() — harness stops here
           Human reviews the proposal and applies manually via `bun run verify-harness-candidate`
```

Output is a dry-run summary: failure clusters found, candidates proposed, validation scores. Nothing is written to the harness source.

---

## Utility Commands

All run from `harness/veritas-example/`.

```bash
bun run bench                        # run committed oracle benchmark suites
bun run verify-claims                # re-derive every headline number from committed artifacts
bun run verify-finding               # run the adversarial refuter against a specific finding
bun run verify-harness-candidate     # evaluate a candidate harness config before promotion
bun run lessons                      # record or retrieve mission lessons
bun run analyze                      # generate analysis/research-analysis-<datetime>.md
bun test                             # run the full test suite (243 tests)
```

### verify-claims

Reads `claims.json` and re-derives every headline number from committed artifacts. Fails if any claim cannot be reproduced. Run before `git push` as the reproducibility gate (invariant 6).

### verify-finding

Runs a separate model instance at elevated temperature to try to disprove a finding using only committed evidence. A finding that survives refutation is promoted to `confirmed`. A finding the refuter disproves is `retracted` with the reason logged.

### verify-harness-candidate

Evaluates a candidate harness config (produced by `bun run dev rsi`) against the committed oracle benchmark suite. Emits a `promote / hold / reject` decision. Never auto-promotes — human executes the merge.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | API key for the default Anthropic provider |
| `HARNESS_PROVIDER` | `anthropic` | Active provider: `anthropic`, `ollama`, `claude-code`, `codex` |
| `HARNESS_MODEL` | from config | Override model for the active provider |
| `VERITAS_RUNS_DIR` | `.veritas/runs` | Where mission run artifacts are written |
| `NO_COLOR` | — | Set to any value to suppress ANSI colour in the banner |
| `LOG_LEVEL` | `info` | Telemetry log level: `debug`, `info`, `warn`, `error` *(planned)* |
| `LOG_FILE` | auto | Override NDJSON log path *(planned)* |
| `LOG_STDOUT` | `false` | Mirror log lines to stdout *(planned)* |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | Enable OpenTelemetry trace export *(planned)* |

---

## Safety Invariants (enforced in code, not convention)

| # | Invariant | Where |
|---|-----------|-------|
| 1 | Scope before action — no side-effecting tool runs outside declared scope | `src/safety/scope.ts` |
| 2 | Fail-safe deny — unattended gated tool with no approver is denied, never silently fired | `src/safety/approval.ts` |
| 3 | Provenance before claim — no finding accepted without a real tool observation in the log | `src/evidence/gate.ts` |
| 4 | Refute before confirm — a second model instance must fail to disprove a finding before promotion | `src/evidence/refuter.ts` |
| 5 | Human before consequence — terminal actions stop one step short; human executes | `src/safety/human-release.ts` |
| 6 | Reproduce before report — every headline number re-derives via `verify-claims` | `scripts/verify-claims.mjs` |
| 7 | Honest decomposition — orchestrator workers always get a truthful description of their subtask | `src/orchestration/` |

---

## Artifacts Layout

```
harness/veritas-example/
  missions/<slug>/
    research-plan.json          compiled plan (Dogma Gate input)
    sources/                    per-source summaries from digest
    synthesis.md                cross-source synthesis
  .veritas/runs/<mission-id>/
    transcript.jsonl            append-only tool calls and observations
    findings.jsonl              accepted findings with provenance
    status.json                 current mission status
  resources/
    experience/<mission-id>/
      entry.json                mission metadata
      transcript.jsonl          same as above, archived post-mission
      findings.jsonl
      scores.json               benchmark outcomes (if bench was run)
    lessons.json                structured lesson store
  analysis/
    research-analysis-<dt>.md   cross-mission synthesis from `bun run analyze`
```
