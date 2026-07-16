# Veritas Console

A standalone React dashboard for the **veritas-example** harness HTTP API. It imports no
harness internals — it is a pure HTTP client, exactly as the teardown note intended.

## Run

```bash
# 1. start the harness API (separate terminal)
cd ../harness/veritas-example && bun run serve      # :8080

# 2. start the dashboard
cd app
bun install
bun run dev                                          # :5173
```

In dev, Vite proxies `/v1/*` and `/health` to the API (`HARNESS_API_URL`, default
`http://localhost:8080`) so the browser needs no CORS. For a built SPA served elsewhere,
set `VITE_HARNESS_API_URL` (see `.env.example`).

## What it covers

| Page | API surface |
|------|-------------|
| **Overview** | `GET /health`, `/v1/provider`, `/v1/loadouts`, held-job banner |
| **Ingest** | `POST /v1/ingest` — brief → plan, Dogma Gate score + violations |
| **Missions** | `POST /v1/missions` (sync or `?async=true`); client-tracked mission list |
| **Mission detail** | `GET /v1/missions/:id`, `/report`, live `/events` (SSE telemetry) |
| **Jobs** | `POST /v1/jobs`, `GET /v1/jobs?status=`, `/v1/jobs/:id` — poll-only, surfaces `held` |

## Notes

- The API has **no list-missions endpoint**, so the Missions tab remembers ids this browser
  started (localStorage). Jobs use the real `GET /v1/jobs` list.
- Job progress is **poll-only**; live streaming is per-mission over SSE.
- `held` job status = a terminal action awaiting human release (safety invariant #5) and is
  surfaced prominently — release happens from the operator terminal, never the browser.

## Build

```bash
bun run typecheck    # tsc, no emit
bun run build        # tsc -b && vite build → dist/
```

Stack: Vite + React 18 + TypeScript + react-router. Generic sidebar/content layout.
