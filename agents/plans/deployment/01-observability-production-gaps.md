# 01 — Observability & logging: production gaps

**Date:** 2026-07-15  
**Status of telemetry on main:** W4 **scaffold + partial emit** — not production-ready observability.  
**Target contract:** `docs/OBSERVABILITY_STACK.md` (design) · shipped pieces under `harness/veritas-example/src/telemetry/`.

---

## 1. What exists today (usable building blocks)

| Piece | Location | Behavior |
|-------|----------|----------|
| Typed `HarnessEvent` union | `telemetry/types.ts` | Flat, auditable kinds (mission / step / tool deny / finding / ingest / provider.error) |
| `EventBus` | `telemetry/bus.ts` | Non-throwing pub/sub (eventemitter3) |
| `StructuredLogger` | `telemetry/logger.ts` | Sync NDJSON append + optional stdout mirror |
| `readEvents` / `summarise` | `telemetry/reader.ts` | Offline fold into `MissionMetrics` |
| Control-plane emits | `control/plane.ts` | `mission.start`, `mission.end`, `finding.proposed` / `confirmed` / `refuted` |
| CLI opt-in | `cli.ts` → `telemetryFromEnv()` | **Only if `LOG_FILE` is set** — no default runDir wiring |
| Config redaction | `config/redact.ts` | Masks keys before logs |
| Human stdout stream | `ControlPlane` `onEvent` | Ad-hoc lines (`→ tool …`), not machine metrics |
| Mission / experience artifacts | `.veritas/runs/`, `resources/experience/` | Full transcript + findings for audit / RSI |
| App SSE stub | `app/.../telemetry/route.ts` | Emits a single `{type:"complete"}` — not live harness events |

**Adjacent (branch `feat/v0.3-api-jobs-postgres`, not main):** `PgSink`, Drizzle `events`/`logs` tables, HTTP SSE over the live bus, session-scoped retention via `ENVIRONMENT`.

---

## 2. Emission gap matrix (contract vs runtime)

Events declared in `HarnessEvent` but **not emitted** by the live mission loop on main:

| Kind | Intended emitter | Production impact if missing |
|------|------------------|------------------------------|
| `step.execute` | Agent / safety path after gate pass | Cannot measure tool mix, step latency, or RSI “denial vs execute” ratios from NDJSON alone |
| `step.observe` | Agent after tool observation | No structured success/failure per step for dashboards |
| `tool.scope_deny` | `safety/scope.ts` / composed `check()` | Scope pressure invisible to telemetry (only human stdout / transcript) |
| `tool.gate_deny` | `safety/approval.ts` | Approval / fail-safe denials invisible as metrics |
| `ingest.gate_pass` / `ingest.gate_fail` | Ingest / plan-eval | STEP 1 quality not in event stream |
| `provider.error` | `src/llm/` | Provider outages not countable without scraping stderr |
| *(design-only)* `step.propose`, `provider.request`, `safety.scope` | OBSERVABILITY_STACK | Still not in shipped union or emitters |

Even when `LOG_FILE` is set, a “successful” mission NDJSON often contains **only** start/end + finding lifecycle — too thin for production ops or RSI weakness mining as specified in PHASE2 B5.

---

## 3. Production observability gaps (by category)

### A. Logging (structured)

| Gap | Why it matters in prod |
|-----|------------------------|
| Telemetry **off by default** (`LOG_FILE` required) | Operators get no NDJSON unless they remember env; Docker/Modal runs silently omit the contract |
| No automatic `events.ndjson` under `.veritas/runs/<id>/` | Artifacts incomplete relative to ops plan §11 |
| `LOG_LEVEL` reserved / unused | Cannot turn down volume in prod without code change |
| Sync `appendFileSync` on hot path | Risk of event-loop stalls under high step counts; no async drain / backpressure |
| No `pino` (or equivalent) despite DEPENDENCIES plan | No std transports, multi-dest, or performant leveled logging |
| Dual channels (human `emit` vs NDJSON) with no correlation id | Hard to join a stderr line to a mission/step in aggregators |
| Template harness (`veritas-research`) has **no** `src/telemetry/` | Inconsistent observability across registered harnesses |
| No request / run / job id on every line | Blocks log aggregation labels (`missionId` alone is insufficient across hosts) |

### B. Metrics

| Gap | Why it matters |
|-----|----------------|
| No `MetricsCollector` / no `metrics.json` at mission close | Ops plan §8 schema unimplemented; UI/RSI/`verify-claims` cannot consume counters |
| Token/cost accounting not rolled up | Transports return `inputTokens`/`outputTokens`; Control plane role claims “cost aggregation” but no durable ledger |
| No SLO metrics (mission success rate, p95 duration, deny rates, refuter retract rate) | Cannot alert or capacity-plan |
| No export to Prometheus / OTLP metrics / cloud metrics | Container orchestration is blind |

### C. Traces

| Gap | Why it matters |
|-----|----------------|
| No `TraceEmitter` / no OTLP | Cannot reconstruct step→tool→provider latency trees across Modal fan-out |
| `OTEL_EXPORTER_OTLP_ENDPOINT` documented but inert | Env contract lies to operators |
| Agent EventEmitter3 events not linked to parent mission span | Distributed debugging across CLI / server / Modal child is impossible |

### D. Live stream & UI

| Gap | Why it matters |
|-----|----------------|
| App `GET .../telemetry` SSE stub | Browser cannot watch STEP 2 |
| Main has no harness HTTP SSE (v0.3 only) | Remote Modal status must poll volume files — no push path from main |
| RSI still mines **experience store**, not `events.ndjson` | PHASE2 B5 “inner→outer interface” incomplete even after W4 files landed |

### E. Persistence & retention

| Gap | Why it matters |
|-----|----------------|
| NDJSON-only on main (no DB sink) | Lost when volume not mounted; no cross-mission query |
| No retention / ENVIRONMENT session purge on main | Disk unbounded in long-lived Docker hosts |
| No backup / export story for `.veritas/runs` | Reproduce-before-report needs durable artifacts (invariant #6) |

### F. Security & compliance of logs

| Gap | Why it matters |
|-----|----------------|
| stdout tool echoes include raw `JSON.stringify(input)` | Scope/approval denials may leak path/URL shapes into container logs; redaction covers keys but not all PII in inputs |
| No explicit “never log completions / raw observations” enforcement test on stdout channel | NDJSON is careful; human channel is not |
| No audit trail for secret access / doctor failures as structured events | Ops blind to misconfig storms |

### G. Health, alerting, runbooks

| Gap | Why it matters |
|-----|----------------|
| `doctor` is binary / CLI | No `/healthz` / `/readyz` for orchestrators beyond Dockerfile `HEALTHCHECK` |
| No alert hooks (provider.error burst, gate_deny spike, mission.error rate) | Production needs paging, not grep |
| Modal capture returns last 2k stderr only | Volume holds truth — but no shipped status poller / metrics scrape |

---

## 4. Minimum “production logging” bar (definition of done)

Treat a deploy as **observability-ready** only when all of the following hold:

1. **Always-on run artifacts:** every mission writes `.veritas/runs/<id>/events.ndjson` (and optionally `metrics.json`) without requiring a one-off `LOG_FILE`.  
2. **Full emit surface:** step execute/observe + scope/gate denies + provider errors + ingest gate outcomes are emitted from the real code paths.  
3. **Stdout policy:** `LOG_STDOUT=true` for containers; human `onEvent` lines either become structured or carry `missionId` + step.  
4. **Export path:** at least one of — volume-mounted NDJSON shipper, Postgres sink (v0.3), or OTLP — with documented labels.  
5. **RSI consumption:** `mineWeaknesses` (or successor) reads the telemetry reader, not only experience JSONL.  
6. **Harness parity:** template + domain harnesses share the same telemetry module contract (or document intentional inertness).  
7. **Secrets:** CI test that NDJSON + container logs contain no live API keys (extend `redact` tests).

---

## 5. Recommended close-order (before/alongside deploy)

```
P0  Wire default runDir NDJSON + emit step/deny/provider events
P0  Write metrics.json at mission.close (MetricsCollector)
P1  Bridge Agent events → EventBus (single correlation id)
P1  Enable LOG_STDOUT in Docker/Modal entrypoints
P2  OTLP TraceEmitter (env-gated) OR ship NDJSON to an aggregator
P2  Merge/adopt v0.3 PgSink + SSE for API-shaped deploys
P3  Alerting rules + /healthz; template harness telemetry parity
```

Do **not** treat Modal as a substitute for this work: remote sandboxes amplify blind spots (ephemeral disks, truncated stderr, no TTY).
