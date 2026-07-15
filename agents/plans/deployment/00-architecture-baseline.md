# 00 — Architecture baseline (deploy lens)

**Date:** 2026-07-15  
**Goal:** One accurate picture of Veritas architecture as it affects deployment, logging, and remote execution.

---

## 1. What Veritas is (operationally)

Veritas is a **meta-harness**: a reusable spine (loop + gates + ledger + refuter + control plane) that stamps out scoped harness packages under `harness/<name>/`. The model supplies judgment; the harness supplies structure, safety, and reproducibility.

```
Intention ──▶ STEP 1 ingest ──▶ research-plan.json ──▶ STEP 2 mission ──▶ findings + artifacts
                 (Dogma Gate)                           (ReAct + safety spine)
```

Two registered harnesses today (`harnesses.json`):

| # | Name | Role | Deploy relevance |
|---|------|------|------------------|
| 1 | `veritas-research` | Pure 8-plane template | Thin reference image; no domain loadouts / ingest / RSI |
| 2 | `veritas-example` | Research domain | **Primary deploy target** — loadouts, ingest, RSI, bench, telemetry W4 |

Root meta CLI (`bun run list-harnesses`, `create-harness`, `harness-doctor`, `veritas`) owns registry and packaging; it is not the mission runtime.

---

## 2. Eight planes (narrow interfaces)

| Plane | Module (per harness) | Deploy implication |
|-------|----------------------|--------------------|
| **Provider** | `src/llm/` | Needs runtime secrets (`ANTHROPIC_API_KEY` / provider keys); fallback chain; token usage returned by transports but **not aggregated as first-class telemetry today** |
| **Safety** | `src/safety/` | Pure predicates — must work identically in Docker/Modal; unattended remote runs stay fail-safe deny |
| **Verification** | `src/evidence/` | Refuter needs a second model call → same secret surface + cost |
| **Memory** | mission ledger + `src/memory/` | Append-only transcript must land on **persistent volume**, not ephemeral container FS |
| **Capability** | `src/tools/` | Tool schema + risk tiers; network tools need egress policy |
| **Execution** | `src/agent/` | Hard `maxSteps`; emits agent events (`toolCall`, `observation`) — **not yet bridged to HarnessEvent bus** |
| **Orchestration** | `src/orchestration/` | Future Modal fan-out unit (one function per subtask); honest decomposition only |
| **Control** | `src/cli.ts` (+ planned HTTP) | Entry surface for containers: `bun run dev <verb>`; root `veritas` forwards to a harness CLI |

Philosophy sources: `THOR.md`, `agents/docs/eight-plane-harness-architecture-doc.md`, `CLAUDE.md`.

---

## 3. Control surfaces that matter for deploy

### Shipped on `main`

| Surface | Path | Notes |
|---------|------|-------|
| Domain CLI | `harness/veritas-example/src/cli.ts` | Headless verbs: `start`, `eval`, `digest`, `ingest`, `status`, `report`, `loadouts`, `rsi` |
| Root launcher | `meta/veritas.ts` | `bun run veritas -- …` / bin `veritas` → forwards to research-capable harness by default |
| Telemetry W4 (partial) | `src/telemetry/{bus,logger,reader,types,index}.ts` | Opt-in via `LOG_FILE`; control plane emits mission + finding events only |
| Mission store | `src/control/store.ts` + `.veritas/runs/` | Snapshots for `status` / `report` |
| Experience store | `src/mission/experience-store.ts` | RSI input under `resources/experience/` |
| Docker assets | `Dockerfile`, `.dockerignore`, `docker-compose.yml` | Present for both harnesses; CLI-shaped (no Postgres on main compose) |
| App (STEP 1 UI) | `app/` | Next.js ingest compile + dogma; telemetry SSE route is still a **stub** |
| Shared contract | `core/` | Schema / dogma / compile-brief — used by app; harness keeps vendored copies + drift-guard |

### Not on `main` (exist on `feat/v0.3-api-jobs-postgres`)

Treat as **adjacent but not baseline** for these plans:

- `src/server/` — Hono HTTP API + SSE telemetry stream  
- `src/jobs/` — Postgres-backed job queue + runner  
- `src/persistence/` — Drizzle schema (sessions, missions, events, logs, jobs)  
- `src/telemetry/pg-sink.ts` — EventBus → Postgres  
- Compose service `postgres:16` with `DATABASE_URL`

Modal: **no `modal/` tree exists on any reviewed branch** — designs only (`OPERATIONS_PLAN` §7, `PHASE2_MODAL_EXECUTION.md`).

---

## 4. Artifact / state model (must survive process death)

```
harness/veritas-example/
  missions/<slug>/research-plan.json     # STEP 1 output — persist
  .veritas/runs/<mission-id>/            # snapshots, transcript, findings — persist
    events.ndjson                        # only when LOG_FILE / runDir telemetry enabled
  resources/experience/<mission-id>/     # RSI archive — persist
  resources/lessons.json                 # lessons delta — persist
  resources/summary/                     # digests — ephemeral / regenerable
```

Env knobs: `VERITAS_RUNS_DIR`, `VERITAS_MISSIONS_DIR` (app plan write), provider overrides.

---

## 5. Deployment topology (intended)

```
                    ┌──────────────────┐
   brief / UI  ───▶│  STEP 1 ingest   │──▶ research-plan.json
                    └──────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   local bun CLI      Docker (compose)      Modal function
   cwd = harness      volumes + .env        Secret + Volume
          │                   │                   │
          └───────────────────┴───────────────────┘
                              ▼
                    STEP 2 ControlPlane.start
                              │
                    artifacts → persistent store
                              │
                    optional: RSI / verify-claims / report
```

**Recommendation already in ops docs:** Docker-first for dev/CI/long audits; Modal as pay-per-second overlay for scheduled / fan-out runs once the image + volume contract is stable.

---

## 6. Doc drift to account for while planning

| Doc claim | Code reality (main, 2026-07-15) |
|------------|----------------------------------|
| `OPERATIONS_PLAN` §8 / older `PHASE2.md` B5: telemetry “not built” | W4 **partially landed** (`src/telemetry/` + mission/finding emits); step/safety/provider/ingest emits **not wired** |
| `OBSERVABILITY_STACK.md`: MetricsCollector, TraceEmitter, pino, OTLP | **Not present** as modules |
| `STATIC_DEPLOYMENT` Modal Approach B (`modal_app.py`) | **Superseded** — do not implement |
| Token/cost aggregation (Control plane role in `planes.ts`) | Transports return tokens; **no mission-level cost ledger / metrics.json** |

This folder’s remaining docs plan from the **code** column, not the stale banners.
