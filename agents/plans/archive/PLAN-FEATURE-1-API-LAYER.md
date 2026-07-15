# PLAN — Feature 1: Harness Execution via an API Layer

**Authored:** 2026-07-15
**Build order:** #2 (after Postgres; before Jobs & UI).
**Owner module:** `harness/veritas-example/src/server/`

---

## Objective

Expose the harness over an HTTP **API layer** that is **launched when the container starts** and
whose behaviour is **dependent on the configured provider** (the same `providerChain()` the CLI uses).
This is the single interface the UI (Feature 3) and external callers use to drive the harness.

## Architecture fit

Today the only front doors are the CLI (`src/cli.ts`) and the MCP *handler* (`src/mcp-server.ts`,
no transport). The API layer is a thin HTTP adapter over the **same** `ControlPlane`, ingest
pipeline, `MissionStore`, and telemetry — never a new execution path (invariant #8: compose, don't
fork). Provider selection flows from `loadConfig()`; the API reports and uses the active provider.

```
HTTP (hono on Bun.serve) ──▶ ControlPlane.start(StartInput)   (existing loop + safety spine)
                        ├──▶ ingest (fit-intent, provider-dependent)
                        ├──▶ MissionStore (status/report)
                        └──▶ telemetry EventBus ──▶ PgSink (Feature 4) + SSE stream
```

## Endpoints (v1)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | liveness + active provider/model + db connectivity |
| GET | `/v1/provider` | active provider, model, fallback chain (redacted) |
| GET | `/v1/loadouts` | registered loadouts |
| POST | `/v1/ingest` | compile a brief → `ResearchPlan` (provider-dependent) + Dogma Gate |
| POST | `/v1/missions` | start a mission (sync) **or** enqueue a job (async, Feature 2) via `?async=true` |
| GET | `/v1/missions/:id` | status + snapshot |
| GET | `/v1/missions/:id/report` | rendered report |
| GET | `/v1/missions/:id/events` | **SSE** live telemetry stream (from EventBus) |

All requests validated with zod at the boundary. Errors use the envelope `{ ok:false, error }`.

## Interfaces (module/function level)

- `src/server/app.ts`
  - `createApp(deps: ServerDeps): Hono` — pure builder (injectable `buildLLM`, `store`, `bus`,
    `sql`), so it is unit-testable via `app.request(...)` with no socket.
  - `ServerDeps = { buildLLM, store, config, sql?, missionsDir }`.
- `src/server/routes/*.ts` — one small router per resource (`health`, `provider`, `loadouts`,
  `ingest`, `missions`). Each handler ≤ ~40 lines.
- `src/server/sse.ts` — `streamMissionEvents(bus, missionId)` → SSE `ReadableStream`; filters the
  bus by `missionId`, ends on `mission.end`.
- `src/server/index.ts` — entry: `loadConfig()` → `migrate()` (Feature 4) → `startSession()` →
  `Bun.serve({ port: PORT, fetch: createApp(deps).fetch })`. Boots the job runner (Feature 2) when
  `RUN_WORKER!==false`. Graceful shutdown closes the pool.
- `package.json`: `"serve": "bun src/server/index.ts"`.

## Provider dependency (explicit)

- `/v1/provider` and `/health` surface `config.defaultProvider` + model + redacted chain.
- `/v1/ingest` and `/v1/missions` build the `LLMBackbone` from `providerChain(config)` per request —
  so switching `HARNESS_PROVIDER`/`HARNESS_MODEL` (env or `local.json`) changes API behaviour with no
  code change. The API never hard-codes a provider.

## Container launch

- Dockerfile `ENTRYPOINT ["bun","run","serve"]` (was `bun run dev`); `EXPOSE 8080`; `HEALTHCHECK`
  hits `/health`.
- docker-compose: `veritas` service `ports: ["8080:8080"]`, `depends_on: [postgres]`,
  `DATABASE_URL`/`ENVIRONMENT` env. The API + worker come up with the container.

## Gates

- **G0 (entry):** Feature 4 landed (pg sink + migrate); `hono` dep added.
- **G1 — app builder:** `createApp` returns a hono app; `/health` returns 200 with provider + db status. *Verify:* `app.request("/health")` test (no socket, injected deps).
- **G2 — read endpoints:** `/v1/loadouts`, `/v1/provider`, `/v1/missions/:id` (known + unknown id → 200/404). *Verify:* route tests with an in-memory store.
- **G3 — ingest & start:** `/v1/ingest` compiles + gates a brief (injected scripted LLM); `/v1/missions` starts a mission and persists a snapshot. *Verify:* route tests with a scripted `buildLLM`.
- **G4 — SSE:** `/v1/missions/:id/events` streams events for a running mission and closes on `mission.end`. *Verify:* SSE unit test over the bus.
- **G5 — container:** `docker compose up` serves `/health` 200; ENTRYPOINT launches the API. *Verify:* documented smoke (compose) + Dockerfile lint.
- **G-exit:** full `bun test` green incl. new `server/*.test.ts`; container serves; provider switch changes `/v1/provider` with no rebuild.

## Safety / invariants

- Every side-effecting call routes through `ControlPlane` + the composed safety check — the API is
  **not** a bypass (like MCP). Scope, approval, evidence, refuter, human-release all still apply.
- Unattended API context ⇒ gated tiers **fail-safe deny** unless `--pre-auth` equivalent is set
  explicitly per request (invariant #2).
- Request bodies are untrusted: zod-validated; intent text carries the UNTRUSTED-DATA contract.

## Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Long missions block a request | sync only for short ops; long runs go async via Feature 2 (`?async`) |
| SSE leaks subscribers | unsubscribe on stream close + `mission.end`; bounded |
| Auth | v1 is container-internal / trusted-network; document that an auth middleware slot exists (`ServerDeps.auth?`) for a later gate |
