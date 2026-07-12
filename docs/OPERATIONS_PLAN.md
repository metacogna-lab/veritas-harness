# VERITAS — Operations Plan

> **Scope:** Full operational reference for the Veritas meta-harness: architecture, current implementation status, deployment (Docker + Modal), phase roadmap, and runbook.
> For CLI flag reference see [CLI.md](./CLI.md). For use-case walkthroughs see [USE-CASES.md](./USE-CASES.md). For primary function description see [PRIMARY-FUNCTION.md](./PRIMARY-FUNCTION.md).

---

## 1. What Veritas Is

Veritas is a **harness factory**: a tiered agent framework (BASIC → INT → ADV) that stamps out safe, reproducible, evidence-grounded agent loops for any objective domain without rewriting the core. The model supplies judgment; the harness supplies structure, safety, and reproducibility — never the reverse.

**Two-step program model** — all agent work reduces to this:

```
STEP 1 — Intention → Plan
  user writes a research brief  →  ingest pipeline  →  research-plan.json
  (validated by Dogma Gate: 8 research-discipline dimensions)

STEP 2 — Plan → Mission
  research-plan.json  →  dev start --plan  →  ReAct agent loop  →  findings
  (controlled by safety spine: scope → approval → evidence → refuter)
```

---

## 2. Repository Structure

```
veritas/                              ← meta-harness root
  ├── core/                           ← shared domain abstractions (schema, dogma, eval, types)
  ├── app/                            ← Next.js 15 web frontend (STEP 1 in browser)
  ├── harness/
  │   ├── veritas-research/           ← pure 8-plane template harness (reference)
  │   └── veritas-example/            ← research domain harness (runnable)
  ├── base-scripts/                   ← shared scripts: doctor, veritas-config, lib/stats
  ├── meta/                           ← meta CLI: create-harness, list-harnesses, doctor
  ├── skills/                         ← generic meta skills (operate ANY harness)
  ├── harnesses.json                  ← ordered harness registry (1-based)
  ├── agents/
  │   ├── config/agents-config.md     ← operating mandate — re-read every session
  │   ├── plans/                      ← build plans
  │   └── state/                      ← session state and build log
  ├── docs/                           ← this directory — operational documentation
  ├── research/                       ← source material corpus
  │   ├── raw/                        ← PDFs + summaries
  │   ├── processed/                  ← structured digests (canonical --target corpus)
  │   └── meta-analyses/              ← cross-paper synthesis
  ├── THOR.md                         ← architecture philosophy (the "why")
  ├── CLAUDE.md                       ← Claude Code project instructions
  └── README.md                       ← quick-start (keep in root)
```

---

## 3. Current Implementation (as of 2026-07-12)

### 3.1 core/ — Shared Domain Abstractions

Pure TypeScript, no harness-specific imports. Consumed by both `app/` (via `@core/*` webpack alias) and any future CLI tool.

| File | Exports | Purpose |
|------|---------|---------|
| `core/schema.ts` | `researchPlanSchema`, `ResearchPlan` | Zod schema — single source of truth for the research-plan contract |
| `core/dogma.ts` | `DEFAULT_DOGMA`, `buildDogma(cfg?)` | 8 research-discipline gate dimensions |
| `core/eval.ts` | `evalPlan()`, `evalPlanWithConfig()` | Run all dogma dimensions; return pass/fail + aggregate score |
| `core/types.ts` | `MissionPayload`, `ApiIngestResult` | API envelope types (ingest request + response) |
| `core/extract-json.ts` | `parseLastObject(text)` | Robust JSON extraction from LLM output — strip fences → last balanced span |
| `core/compile-brief.ts` | `serverCompileBrief(payload)` | Compile user intent → `ResearchPlan` via LLM (retry ×2 on parse failure) |

**ResearchPlan shape:**
```typescript
{
  version: "1";
  metadata: { slug, ingestedAt, ingestVersion, model };
  objective: string;           // min 15 chars
  loadout: "codebase-audit" | "research" | "web-recon";
  target: string;              // filesystem path or hostname
  scope: { hosts: string[]; paths: string[] };
  specialists: Array<{ role, focus }>;  // min 2 entries
  phases: Array<{ id, description }>;  // min 2 entries
  sources: Array<{ url, type, description }>;
  lessons: string[];
  successCriteria: string[];   // each must contain measurable language
}
```

### 3.2 app/ — Next.js 15 Frontend (STEP 1 in Browser)

**Phase 1 complete.** Web-based intake path for the ingest step only.

**Path aliases:**
- `@/*` → `app/src/*`
- `@core/*` → `../core/*` (webpack alias + tsconfig paths)

**Key routes:**

| Route | Description |
|-------|-------------|
| `GET /` | Home — two-step explanation + quick facts |
| `GET /ingest` | Mission intake form (slug, objective, target, loadout, optional file upload) |
| `POST /api/v1/missions` | Compile brief → dogma gate → return plan or violations |
| `GET /missions/result` | Dimension scores + CLI handoff command |
| `GET /api/v1/missions/:id/telemetry` | **Phase 2 stub** — SSE returning single `{type:"complete"}` immediately |

**POST /api/v1/missions flow:**
```
multipart/form-data or application/json
  → validate (slug regex, objective ≥25 chars)
  → serverCompileBrief() — LLM → ResearchPlan
  → evalPlanWithConfig()  — 8 dogma dimensions
  → 200 { ok:true, slug, plan, score, dimensions }
  → 400 { ok:false, error, violations }    (gate fail)
  → 422 { ok:false, error }                (compile error)
```

**Phase 1 limitation:** The web app produces a plan and CLI handoff; it does not write `research-plan.json` to disk or trigger STEP 2. The user runs `bun run ingest` + `bun run dev start` locally.

### 3.3 harness/veritas-research/ — 8-Plane Template (Reference)

Generic infrastructure only. No domain loadouts, no ingest pipeline.

```
src/
├── llm/            LLMBackbone.complete() — provider abstraction + fallback chain
├── config/         typed config, env-var key resolution, redact()
├── agent/          ReAct loop + LoadoutRegistry (no concrete loadouts)
├── safety/
│   ├── scope.ts        checkScope() — pure predicate; deny off-scope/loopback/private
│   ├── approval.ts     requestApproval() — risk-tier gating; fail-safe deny unattended
│   ├── human-release.ts  requireHumanRelease() — stop before consequential actions
│   └── index.ts        composed check(): checkScope → requestApproval
├── tools/          typed ToolRegistry { name, description, inputSchema (zod), riskTier, run() }
├── parse/          robust JSON extraction (strip fences → direct parse → balanced span)
├── mission/        Mission object: append-only transcript + findings
├── evidence/       provenance gate + adversarial refuter
├── orchestration/  ADV-tier decomposition orchestrator (honest decomposition only)
└── mcp-server.ts   safe scope-gated MCP subset
```

**Tests:** 178 tests — pure infrastructure, no domain tests.

### 3.4 harness/veritas-example/ — Research Domain Harness (Runnable)

Full domain harness — extends the 8-plane template with ingest, RSI, bench, and three loadouts.

```
src/
├── agent/loadouts.ts     codebase-audit, research, web-recon
├── ingest/               sanitize → parse → fit (LLM) → validate (Zod) → dogma gate → research-plan.json
├── resources/            research-plan.ts, plan-eval.ts, source-digest.ts, lessons.ts
├── rsi/                  recursive self-improvement loop (dry-run only; human-gated apply)
├── memory/               context-window.ts — ephemeral windowing
└── config/dogma.ts       research-plan schema validation config (domain extension)
scripts/
├── verify-claims.mjs     re-derive every headline number from committed artifacts
├── verify-finding.mjs    adversarial refuter against a finding
├── bench.mjs             committed-oracle benchmark suites
├── lessons.mjs           record/retrieve lessons CLI
└── analyze.mjs           generate research-analysis-{datetime}.md
```

**Tests:** 243 tests across 28 files.

---

## 4. Safety Spine (Non-Negotiable Invariants)

Baked into code, tests, and CI — never bypassed, never configured away.

| # | Invariant | Enforced In |
|---|-----------|-------------|
| 1 | **Scope before action** — no side-effecting tool runs outside declared scope | `src/safety/scope.ts` |
| 2 | **Fail-safe deny** — gated tool with no approver wired = deny, never silently fire | `src/safety/approval.ts` |
| 3 | **Provenance before claim** — no finding accepted without a real tool observation in the log | `src/evidence/gate.ts` |
| 4 | **Refute before confirm** — a second model instance must fail to disprove a finding | `src/evidence/refuter.ts` |
| 5 | **Human before consequence** — terminal actions stop one step short; human executes | `src/safety/human-release.ts` |
| 6 | **Reproduce before report** — every headline number re-derives via `verify-claims` | `scripts/verify-claims.mjs` |
| 7 | **Honest decomposition** — orchestrator workers always get a truthful task description | `src/orchestration/` |
| 8 | **Compose, don't fork** — new domains are a new Loadout, never a copy of the agent loop | Loadout API |

---

## 5. Phase Roadmap

### Phase 1 — BASIC ✅ Complete

One agent, one loop, one tool set, running safely and reproducibly.

- Provider abstraction (`src/llm/`) — `LLMBackbone.complete()`, fallback chain, text-mode tool-calling shim
- Config + key management (`src/config/`) — env-var resolution, `redact()` before any logging
- Scope gate (`src/safety/scope.ts`) — deny off-scope/loopback/private by default
- Typed tool registry (`src/tools/`) — name, Zod inputSchema, riskTier, run()
- Robust output parsing (`src/parse/`) — strip fences, scan balanced bracket spans
- Mission object (`src/mission/`) — append-only transcript and findings
- ReAct loop (`src/agent/`) — propose → check → execute → observe → repeat → stop
- Web frontend (`app/`) — STEP 1 in browser: form → compile → gate → result
- Three loadouts: `codebase-audit`, `research`, `web-recon`

### Phase 2 — INT 🔄 In Progress

Multiple specialists, human-in-the-loop safety, evidence you can trust.

- Specialist loadouts composed into same loop
- Approval gating with fail-safe deny
- Evidence ledger and provenance gate
- Adversarial refuter (second model instance)
- CLI control plane and HTTP API
- Reproducibility guard (pre-push hook)
- **Mission status stream:** `/api/v1/missions/:id/telemetry` SSE (stub → real)
- **Modal execution:** portable, scalable mission sandboxes (see Section 7)
- Observability stack: EventBus → StructuredLogger → NDJSON + optional OTLP (see Section 8)

### Phase 3 — ADV (Planned)

Orchestration across models, honest benchmarking, structured improvement.

- Decomposition orchestrator — honest subtask descriptions only (invariant 7 enforced by test)
- Benchmark harness with committed ground-truth oracles, Wilson-95 CIs, anti-fitting guard
- `requireHumanRelease` on every consequential terminal action
- Lessons loop — record structured takeaways per mission
- Browser-triggered STEP 2: start mission from web app

### Phase 4 — Skills + Consumability (Planned)

Harness self-extension and accessibility.

- `harness-tool-adder`, `harness-eval-runner`, `harness-refuter` skills
- Slash commands: `/add-tool`, `/verify`, `/bench`, `/new-loadout`
- `src/mcp-server.ts` safe scope-gated subset over MCP

---

## 6. Docker Deployment

### 6.1 Prerequisites

| Requirement | Detail |
|-------------|--------|
| Docker | 20.10+ (Compose V2 included) |
| Bun | Latest stable (pinned via `bun.lock`) |
| Git | On PATH (used by mission tooling) |
| `ANTHROPIC_API_KEY` | Required for default provider — **never baked into image** |

Secrets are **always runtime-injected** — never in the image layer. The `.dockerignore` excludes `.env*` and `src/config/local.json`.

### 6.2 Template Harness (`harness/veritas-research/`)

**Dockerfile (multi-stage):**
```dockerfile
# Stage 1: install deps (layer-cached separately from source)
FROM oven/bun:latest AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Stage 2: runtime image
FROM oven/bun:latest
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD bun run doctor || exit 1

VOLUME ["/app/.veritas"]
ENTRYPOINT ["bun", "run", "dev"]
CMD ["loadouts"]
```

**docker-compose.yml (local dev):**
```yaml
services:
  veritas:
    build: .
    env_file: .env
    volumes:
      - veritas-runs:/app/.veritas

volumes:
  veritas-runs:
```

### 6.3 Domain Harness (`harness/veritas-example/`)

The domain harness extends the template with three additional persistent volumes.

**docker-compose.yml:**
```yaml
services:
  veritas:
    build: .
    env_file: .env          # ANTHROPIC_API_KEY and optional overrides
    volumes:
      - ./missions:/app/missions
      - veritas-runs:/app/.veritas
      - veritas-experience:/app/resources/experience
    stdin_open: false        # CLI is headless; no tty needed

volumes:
  veritas-runs:
  veritas-experience:
```

### 6.4 Persistent State

| Directory | Contents | Mount? |
|-----------|----------|--------|
| `.veritas/runs/` | Mission snapshots (transcript, findings, status) | **Yes — named volume** |
| `missions/` | Ingested `research-plan.json` files | **Yes — bind mount** |
| `resources/experience/` | Per-mission RSI input | **Yes — named volume** |
| `resources/lessons.json` | Lessons delta store | Via experience volume |
| `resources/summary/` | Generated source digests | Ephemeral — re-generated |
| `node_modules/`, `build/` | Install + compile artifacts | Ephemeral — rebuilt |

### 6.5 Build and Run Commands

```bash
# Build the domain harness image
cd harness/veritas-example
docker compose build

# Run doctor (health check) inside the container
docker compose run --rm veritas doctor

# Run a mission (plan already ingested locally)
docker compose run --rm veritas \
  start --plan /app/missions/my-mission/research-plan.json

# Convenience wrapper (run from harness directory)
bash scripts/docker-mission.sh \
  --plan missions/my-mission/research-plan.json
```

**`scripts/docker-mission.sh`:**
```bash
#!/usr/bin/env bash
set -euo pipefail
docker run --rm \
  --env-file "${ENV_FILE:-.env}" \
  -v "$(pwd)/missions:/app/missions" \
  -v "veritas-runs:/app/.veritas" \
  -v "veritas-experience:/app/resources/experience" \
  veritas-example:latest \
  start "$@"
```

### 6.6 Provider Overrides in Docker

```bash
# Env file approach (recommended)
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
echo "HARNESS_MODEL=claude-opus-4-8" >> .env

# One-off env flag
docker run --rm -e ANTHROPIC_API_KEY=sk-ant-... -e HARNESS_PROVIDER=anthropic \
  veritas-example:latest start "objective" --target /app/missions/my-scope
```

### 6.7 .dockerignore

```
node_modules/
.veritas/
resources/experience/
resources/summary/
ingest/NEW.md
src/config/local.json
*.log
.env*
build/
```

### 6.8 CI Integration

```yaml
# GitHub Actions snippet
- name: Verify harness
  run: |
    cd harness/veritas-example
    bun install --frozen-lockfile
    bun run doctor
    bun test
    bun run bench
    bun run verify-claims
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

- name: Build Docker image
  run: docker build -t veritas-example:${{ github.sha }} harness/veritas-example/
```

### 6.9 Security Notes

1. **Secrets never in images.** Always runtime-injected via `--env-file`, orchestrator secrets, or Modal secrets store.
2. **Health check.** `bun run doctor` verifies key presence and redaction before any mission starts.
3. **Scope gate holds.** Containerisation does not weaken the scope gate — it enforces `--target` regardless of runtime environment.
4. **Volume permissions.** Run as a non-root user in production; mount paths need write permission for that UID.

---

## 7. Phase 2 — Modal Execution (In Development)

> **Status:** Plan — post-MVP. Docker is the primary deployment path. Modal adds portability, parallel fan-out, and zero-idle-cost for batch/scheduled runs.

### 7.1 Motivation

Each mission runs in an isolated Modal container — billed per-second, no persistent server. This unlocks:
- Parallel mission execution (one container per sub-task in the orchestrator fan-out)
- Reproducibility across machines (same image, same secrets)
- Zero ops overhead vs. running a long-lived host

### 7.2 Architecture

```
UI / CLI
  │
  ▼
bun run ingest --json          ← compile research-plan.json locally
  │
  ▼
modal/runner.py                ← Modal App entry point
  ├─ modal.Secret("veritas")   ← ANTHROPIC_API_KEY, HARNESS_PROVIDER
  ├─ modal.Volume("missions")  ← research-plan.json + mission artifacts
  └─ spawn: harness_run.remote(plan_path)
       │
       └─ bun run dev start --plan /mnt/missions/<slug>/research-plan.json
            │
            └─ artifacts → /mnt/missions/<slug>/.veritas/runs/<id>/
```

### 7.3 Components

#### `modal/runner.py` — Modal App

```python
import modal

app = modal.App("veritas")
vol = modal.Volume.from_name("veritas-missions", create_if_missing=True)
image = modal.Image.from_dockerfile("harness/veritas-example/Dockerfile")
secret = modal.Secret.from_name("veritas")

@app.function(image=image, secrets=[secret],
              volumes={"/mnt/missions": vol},
              timeout=3600, memory=2048)
def harness_run(plan_path: str) -> dict:
    import subprocess
    result = subprocess.run(
        ["bun", "run", "dev", "start", "--plan", plan_path],
        capture_output=True, text=True, cwd="/app"
    )
    return {"exit": result.returncode, "stderr": result.stderr[-2000:]}
```

Full transcript lives in the Volume; only the last 2000 chars of stderr are returned to avoid context bloat.

#### `modal/ingest_and_run.py` — One-Shot Pipeline Trigger

Accepts `--objective` + `--slug`, runs ingest (locally or inside Modal), uploads plan to Volume, spawns `harness_run.remote()` non-blocking, prints `{ run_id, slug }`.

#### `modal/status.py` — Artifact Poller

Reads `.veritas/runs/<id>/status.json` from the Volume. Called by UI every 5–10 s during live missions.

#### Image: `modal/Dockerfile.modal`

Thin wrapper that skips dev-dependency layers for a smaller production image. Base: `oven/bun:latest`.

### 7.4 Modal Secret Setup

```bash
# Register API key once
modal secret create veritas \
  ANTHROPIC_API_KEY=sk-ant-... \
  HARNESS_PROVIDER=anthropic \
  HARNESS_MODEL=claude-haiku-4-5-20251001

# Create the missions volume
modal volume create veritas-missions

# Deploy
cd harness/veritas-example
modal deploy modal/runner.py

# Trigger a one-off mission
python modal/ingest_and_run.py \
  --slug my-mission \
  --objective "survey RSI techniques and identify open problems" \
  --target "resources/processed/"

# Poll status
python modal/status.py --slug my-mission
```

### 7.5 Volume Layout

```
/mnt/missions/
  <slug>/
    research-plan.json          ← written by ingest, read-only at runtime
    .veritas/runs/<id>/          ← transcript, findings, status (append-only)
    experience/                  ← post-mission RSI artifacts
```

### 7.6 Compute Strategy

| Consideration | Decision |
|--------------|----------|
| Model for workers | `claude-haiku-4-5-20251001` by default — 90% of Sonnet capability, 3× cost savings |
| Override to Sonnet | Set `HARNESS_MODEL=claude-sonnet-4-6` via `modal.Secret` or per-mission env |
| Parallelism | ADV orchestrator spawns one `harness_run.remote()` per sub-task; Modal handles concurrency |
| Token runaway | `--max-steps` cap in ControlPlane; Modal `timeout=3600` hard kill |
| Cold start | ~5 s first run; acceptable for research missions; pre-warm with `modal container start` if needed |

### 7.7 Milestones

| # | Deliverable | Status |
|---|-------------|--------|
| M1 | `modal/runner.py` — single `harness_run` function | Planned |
| M2 | Volume wired — artifacts persist across runs | Planned |
| M3 | `modal/ingest_and_run.py` — one-command pipeline | Planned |
| M4 | `modal/status.py` — polling for UI integration | Planned |
| M5 | Parallel fan-out — orchestrator spawns N functions | Planned (ADV) |

### 7.8 Safety Invariants Preserved in Modal

- **Invariant #2 (fail-safe deny):** unattended Modal run has no approver → intrusive/dangerous tiers denied
- **Invariant #5 (human before consequence):** `requireHumanRelease` fires; Modal function exits 0 with `PENDING` status
- **Invariant #6 (reproduce before report):** `verify-claims` runs post-mission inside the same container before artifacts are sealed

### 7.9 Docker vs. Modal Comparison

| Criterion | Docker | Modal |
|-----------|--------|-------|
| Setup complexity | Low (one Dockerfile) | Medium (Python wrapper + secrets) |
| Cold start latency | <2 s (cached image) | 5–10 s first run |
| Persistent state | Named volumes (local) or EFS/EBS | Modal volumes (cloud) |
| Cost model | Compute + storage always-on | Pay per execution second |
| Scheduling | External cron / Kubernetes CronJob | Built-in `modal.Cron` |
| Long-running missions | Ideal | Timeout ≤ 1 h (configurable) |
| Recommended for | Dev, CI, long audits, ECS/K8s | Scheduled research, cost-optimized batch |

**Recommendation:** Docker-first. Add Modal as the scheduled-run overlay once Docker is stable.

---

## 8. Observability Stack (Phase 2)

Structured, machine-readable telemetry for RSI loop mining, cross-mission analytics, live UI progress, and optional OTLP export.

### 8.1 Architecture

```
Harness Events
     │
     ▼
  EventBus (in-process, typed — eventemitter3)
     │
     ├──▶ StructuredLogger  →  NDJSON per event → .veritas/runs/<id>/events.ndjson
     │                                          → stdout (when LOG_LEVEL=debug)
     │
     ├──▶ MetricsCollector  →  mission.metrics.json (at mission close)
     │
     └──▶ TraceEmitter      →  OTLP (optional, zero-cost when env var absent)
```

### 8.2 Event Types

```typescript
type HarnessEvent =
  | { kind: "mission.start";     missionId: string; slug: string; objective: string }
  | { kind: "mission.end";       missionId: string; status: "ok"|"error"; durationMs: number }
  | { kind: "step.propose";      missionId: string; step: number; action: string; tool: string }
  | { kind: "step.execute";      missionId: string; step: number; tool: string; riskTier: string }
  | { kind: "step.observe";      missionId: string; step: number; ok: boolean; tokens: number }
  | { kind: "tool.scope_deny";   missionId: string; tool: string; reason: string }
  | { kind: "tool.gate_deny";    missionId: string; tool: string; tier: string }
  | { kind: "finding.proposed";  missionId: string; findingId: string; confidence: number }
  | { kind: "finding.refuted";   missionId: string; findingId: string; reason: string }
  | { kind: "finding.confirmed"; missionId: string; findingId: string }
  | { kind: "ingest.gate_pass";  slug: string; score: number }
  | { kind: "ingest.gate_fail";  slug: string; errors: string[] }
  | { kind: "provider.request";  provider: string; model: string; tokens: number }
  | { kind: "provider.error";    provider: string; error: string }
```

### 8.3 Log Line Format (NDJSON)

```json
{"t":"2026-07-12T03:10:00.000Z","lvl":"info","kind":"step.execute","missionId":"m_abc123","tool":"read_file","riskTier":"safe","step":3}
{"t":"2026-07-12T03:10:01.000Z","lvl":"warn","kind":"tool.scope_deny","missionId":"m_abc123","tool":"http_get","reason":"host not in scope"}
{"t":"2026-07-12T03:10:02.000Z","lvl":"error","kind":"provider.error","provider":"anthropic","error":"rate_limit"}
```

Always-present: `t` (ISO), `lvl`, `kind`. Optional fields per event type, max 1 level deep. Raw tool outputs and model completions are **never** logged.

### 8.4 Environment Controls

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_FILE` | `.veritas/runs/<id>/events.ndjson` | Always-on NDJSON output |
| `LOG_LEVEL` | `info` | `debug` enables step.propose + provider.request |
| `LOG_STDOUT` | `false` | Mirror log lines to stdout |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | Enable trace export; zero cost when unset |

### 8.5 File Layout

```
src/telemetry/
  bus.ts          EventBus — typed pub/sub (eventemitter3 wrapper)
  logger.ts       StructuredLogger — NDJSON writer (pino)
  metrics.ts      MetricsCollector — per-mission counters
  trace.ts        TraceEmitter — OTLP spans (optional, dynamic load)
  reader.ts       LogReader — parse events.ndjson for RSI/UI
  types.ts        HarnessEvent union + MissionMetrics types
  index.ts        Re-exports; initialises stack from env
```

### 8.6 Key Dependencies (research-grounded)

| Dependency | Phase | Purpose |
|-----------|-------|---------|
| `pino` | INT | NDJSON logging — 5–8× faster than console.log on hot agent loop paths |
| `@opentelemetry/sdk-node` | INT | Span-level timing; optional OTLP export |
| `ts-morph` | ADV | AST-level bounded harness edits (Self-Harness ablation: 66.7% vs 57.1% for string rewrite) |
| `@lancedb/lancedb` | ADV | Queryable experience store — semantic + full-text hybrid search |
| `diff` | ADV | Auditable patch previews for human approval before any harness candidate is applied |
| `arquero` | ADV | Quality-Diversity archive queries over loadout variant scores |
| `execa` | Skills | Sandboxed subprocess with timeouts for `bun test` + `bun run bench` in RSI validator |
| `modal` (Python) | Deploy | Containerised mission execution — per-second billing, Volume persistence |
| `hono` | UI | SSE event streaming + status API (Bun-native, ~14 KB) |

---

## 9. Harness Creation Pipeline

New harnesses are created **only** through the meta pipeline — never by hand.

```bash
# From the repo root
bun run create-harness <name> [--capabilities a,b]
```

| Stage | What happens |
|-------|-------------|
| 1 — validate | Kebab-case name check; confirms not already registered; verifies `harness/<name>/` is free |
| 2 — scaffold | Copies `meta/templates/harness-template/` into `harness/<name>/`; substitutes `__HARNESS_NAME__` |
| 3 — capabilities | Installs selected capability packs from `meta/templates/skills/<pack>/` |
| 4 — manifest | Writes `harness/<name>/harness.json` |
| 5 — register | Appends to `harnesses.json` (1-based index) |
| 6 — install | Runs `bun install` inside the new harness |
| 7 — test | Runs `bun test` — must be green before the harness is usable |

---

## 10. Operational Runbook

### 10.1 First-Time Setup

```bash
# 1. Clone and install meta-harness root
git clone <repo> veritas && cd veritas
bun install

# 2. Install domain harness
cd harness/veritas-example && bun install

# 3. Configure provider
bun run veritas-config    # interactive wizard → writes src/config/local.json

# 4. Health check
bun run doctor
```

### 10.2 Running a Mission (CLI)

```bash
cd harness/veritas-example

# STEP 1: Compile brief into a research plan
bun run ingest -s my-mission -o "Audit the authentication flow and verify ≥3 attack surfaces" -t ./src

# STEP 1b: Validate plan (optional — runs automatically after ingest)
bun run dev eval --plan missions/my-mission/research-plan.json

# STEP 1c: Digest sources
bun run dev digest --plan missions/my-mission/research-plan.json

# STEP 2: Execute mission
bun run dev start --plan missions/my-mission/research-plan.json

# Monitor
bun run dev status <mission-id>
bun run dev report <mission-id>
```

### 10.3 Running a Mission (Docker)

```bash
cd harness/veritas-example
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# Ingest locally (writes missions/ directory)
bun run ingest -s my-mission -o "Audit auth flow" -t .

# Run STEP 2 inside Docker
docker compose run --rm veritas \
  start --plan /app/missions/my-mission/research-plan.json
```

### 10.4 Switching Providers

```bash
# One-off
HARNESS_PROVIDER=ollama HARNESS_MODEL=qwen3-coder:latest bun run dev start ...
HARNESS_PROVIDER=claude-code bun run dev start ...    # use active claude CLI session
HARNESS_MODEL=claude-opus-4-8 bun run dev start ...  # override model only

# Persistent
bun run veritas-config
```

### 10.5 Verifying a Finding

```bash
bun run verify-finding
# Adversarial refuter — second model instance tries to disprove using committed evidence
# Survives → confirmed.  Fails → retracted with reason logged.
```

### 10.6 Running the RSI Loop

```bash
bun run dev rsi
# Dry-run only — proposes harness edits, never self-applies
# Output: failure clusters, candidate edits, validation scores
# Human reviews and applies via: bun run verify-harness-candidate
```

### 10.7 Benchmarks and Claims Verification

```bash
bun run bench               # run committed oracle benchmark suites
bun run verify-claims       # re-derive every headline number (pre-push gate — invariant 6)
bun run analyze             # cross-mission synthesis → analysis/research-analysis-<dt>.md
```

### 10.8 Meta-Harness Commands

```bash
# From repo root
bun run list-harnesses      # show harness registry
bun run harness-doctor      # health check both harnesses
bun run create-harness <name> --capabilities research
```

---

## 11. Artifacts Layout (Quick Reference)

```
harness/veritas-example/
  missions/<slug>/
    research-plan.json         compiled plan (Dogma Gate input)
    sources/                   per-source summaries from digest
    synthesis.md               cross-source synthesis
  .veritas/runs/<mission-id>/
    transcript.jsonl           append-only tool calls and observations
    findings.jsonl             accepted findings with provenance
    status.json                current mission status
    events.ndjson              structured telemetry (Phase 2)
    metrics.json               per-mission counters (Phase 2)
  resources/
    experience/<mission-id>/
      entry.json               mission metadata
      transcript.jsonl         archived post-mission
      findings.jsonl
      scores.json              benchmark outcomes (if bench was run)
    lessons.json               structured lesson store
  analysis/
    research-analysis-<dt>.md  cross-mission synthesis from bun run analyze
```

---

## 12. Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | API key for default Anthropic provider |
| `HARNESS_PROVIDER` | `anthropic` | Active provider: `anthropic`, `ollama`, `claude-code`, `codex`, `openai`, `openrouter` |
| `HARNESS_MODEL` | from config | Override model for active provider |
| `VERITAS_RUNS_DIR` | `.veritas/runs` | Mission run artifact location |
| `NO_COLOR` | — | Suppress ANSI colour in banner |
| `LOG_LEVEL` | `info` | Telemetry log level: `debug`, `info`, `warn`, `error` |
| `LOG_FILE` | auto | Override NDJSON log path |
| `LOG_STDOUT` | `false` | Mirror log lines to stdout |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | Enable OpenTelemetry trace export |
| `VERITAS_MODEL` | `claude-sonnet-4-6` | Model used by the web app (`app/`) |
| `OPENAI_API_KEY` | — | Required only if `HARNESS_PROVIDER=openai` |
| `OPENROUTER_API_KEY` | — | Required only if `HARNESS_PROVIDER=openrouter` |
