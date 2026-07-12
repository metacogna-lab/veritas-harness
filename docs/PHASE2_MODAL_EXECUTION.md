# Phase 2 — Harness Execution in Modal Sandboxes

## Status: PLAN (post-MVP) — **NOT YET IMPLEMENTED**

> **Canonical Modal design (veritas-v0.2 H-3).** This document — together with the identical
> `OPERATIONS_PLAN.md §7` — is the single source of truth for Modal execution: entry `modal/runner.py`,
> image via `Image.from_dockerfile(...)`, function `harness_run(plan_path)`. The Modal sketch in
> `STATIC_DEPLOYMENT.md` (Approach B) is a superseded earlier draft. No `modal/` code exists yet;
> build only after the v0.2 consolidation workstreams land (see `agents/plans/PHASE2.md`). Note: this
> file is about Modal; `agents/plans/PHASE2.md` is the (distinct) interface-boundary plan for 0.2.

## Context

Phase 1 delivered a locally-runnable harness (ingest → eval → digest → start). Phase 2 makes missions **portable and scalable**: each mission runs inside an isolated Modal container, billed per-second, with no persistent server. This unlocks parallel mission execution, reproducibility across machines, and a clean boundary for the future Veritas UI.

## Objective

Run any veritas-example mission (`bun run dev start --plan <plan.json>`) inside a Modal sandbox with zero local compute dependency. Secrets injected via Modal's secret store. Artifacts written to a Modal Volume. UI triggers missions via the JSON ingest CLI and polls status.

## Compute Philosophy

- **Ephemeral functions** — no idle cost; pay only for active mission runtime
- **Haiku 4.5 for workers** — 90% of Sonnet capability at 3× savings; swap to Sonnet for complex loadouts via `HARNESS_MODEL` env var
- **Parallelism via fan-out** — orchestrator spawns one Modal function per decomposed sub-task; each runs independently
- **Token budgets enforced at mission level** — `maxSteps` cap prevents runaway loops

---

## Architecture

```
UI / CLI
  │
  ▼
bun run ingest --json          ← compile research-plan.json
  │
  ▼
modal_runner.py                ← Modal App entry point
  ├─ modal.Secret("veritas")   ← ANTHROPIC_API_KEY, HARNESS_PROVIDER
  ├─ modal.Volume("missions")  ← research-plan.json + mission artifacts
  └─ spawn: harness_run.remote(plan_path)
       │
       └─ bun run dev start --plan /mnt/missions/<slug>/research-plan.json
            │
            └─ artifacts written to /mnt/missions/<slug>/
```

## Components

### 1. `modal/runner.py` — Modal App

```python
import modal
app = modal.App("veritas")
vol = modal.Volume.from_name("veritas-missions", create_if_missing=True)
image = modal.Image.from_dockerfile("harness/veritas-example/Dockerfile")
secret = modal.Secret.from_name("veritas")

@app.function(image=image, secrets=[secret], volumes={"/mnt/missions": vol},
              timeout=3600, memory=2048)
def harness_run(plan_path: str) -> dict:
    import subprocess, json
    result = subprocess.run(
        ["bun", "run", "dev", "start", "--plan", plan_path],
        capture_output=True, text=True, cwd="/app"
    )
    return {"exit": result.returncode, "stderr": result.stderr[-2000:]}
```

**Token efficiency note:** `capture_output=True` captures only last 2000 chars of stderr — full transcript lives in the Volume.

### 2. `modal/ingest_and_run.py` — One-shot pipeline trigger

Accepts objective + slug, runs ingest locally (or inside Modal), uploads plan to Volume, then spawns `harness_run.remote()`. Returns immediately with a run ID for status polling.

### 3. `modal/status.py` — Artifact poller

Reads `missions/<slug>/.veritas/runs/<id>/status.json` from the Volume. Called by UI every 5–10s.

### 4. Dockerfile adjustments

Current `Dockerfile` uses multi-stage bun build. Modal needs:
- Stage `oven/bun:latest` as base (matches existing)
- `WORKDIR /app`
- `COPY . .` + `RUN bun install --frozen-lockfile`
- No CMD (Modal overrides entrypoint per function)

Add `modal/Dockerfile.modal` as a thin wrapper that skips the dev-dependencies layer for production image size.

### 5. Secret: `veritas` (Modal dashboard)

```
ANTHROPIC_API_KEY=sk-ant-...
HARNESS_PROVIDER=anthropic
HARNESS_MODEL=claude-haiku-4-5-20251001   # default; override per mission
```

### 6. Volume: `veritas-missions`

```
/mnt/missions/
  <slug>/
    research-plan.json      ← written by ingest, read-only at runtime
    .veritas/runs/<id>/     ← transcript, findings, status
    experience/             ← post-mission RSI artifacts
```

Volume is append-only from harness perspective. UI reads it via `modal.Volume` Python API.

---

## Execution Flow (token-efficient)

```
1. LOCAL  bun run ingest -s <slug> -o "..." --json
          → missions/<slug>/research-plan.json

2. LOCAL  python modal/ingest_and_run.py --plan missions/<slug>/research-plan.json
          → uploads plan to Volume
          → calls harness_run.spawn(plan_path)  ← non-blocking
          → prints { "run_id": "...", "slug": "..." }

3. MODAL  harness_run() executes:
          bun run dev start --plan /mnt/missions/<slug>/research-plan.json
          (max 60 min, 2 GB RAM, billed per second)

4. POLL   python modal/status.py --slug <slug>
          → reads .veritas/runs/<id>/status.json from Volume
          → { status: "running"|"done"|"error", steps: N, findings: M }

5. DONE   bun run report <id>   (locally, reading from Volume mount)
```

---

## Constraints & Risks

| Risk | Mitigation |
|------|-----------|
| Ephemeral filesystem loses transcript | Harness writes all artifacts to Volume mount `/mnt/missions/` via `VERITAS_RUNS_DIR=/mnt/missions/<slug>` env var |
| Cold start latency (~5s) | Acceptable for research missions; pre-warm with `modal container start` if needed |
| Token runaway | `maxSteps` enforced in ControlPlane; Modal `timeout=3600` hard kill |
| Secret leakage in logs | `redact()` already wraps all config logging; Modal logs are private |
| Volume corruption | Write artifacts to `<slug>/<run_id>/` subdirs; never overwrite existing runs |

## Invariants Preserved

- **Invariant #2 (fail-safe deny)**: unattended Modal run has no approver → intrusive/dangerous tiers denied
- **Invariant #5 (human before consequence)**: `requireHumanRelease` still fires; the Modal function exits 0 with a PENDING status for human to confirm
- **Invariant #6 (reproduce before report)**: `verify-claims` runs post-mission inside the same container before artifacts are sealed

---

## Milestones

| # | Deliverable | Notes |
|---|-------------|-------|
| M1 | `modal/runner.py` — single `harness_run` function | Manual trigger, no UI |
| M2 | Volume wired — artifacts persist across runs | Enables verify-claims |
| M3 | `modal/ingest_and_run.py` — one-command pipeline | `python modal/ingest_and_run.py --slug X --objective "..."` |
| M4 | `modal/status.py` — polling endpoint | Ready for UI integration |
| M5 | Parallel fan-out — orchestrator spawns N functions | ADV-tier orchestration |

## Dependencies

- `modal` Python SDK: `pip install modal`
- Modal account + workspace
- `veritas` secret configured in Modal dashboard
- `veritas-missions` Volume created: `modal volume create veritas-missions`
