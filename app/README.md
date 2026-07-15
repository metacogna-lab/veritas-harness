# Veritas UI (reserved)

This directory is a reserved placeholder. There is no in-repo UI.

The interface to the harness is the **HTTP API** in `harness/veritas-example`:

```bash
cd harness/veritas-example
bun run serve          # launches the API on :8080 (also runs in the container)
```

A future UI is a standalone client (any framework) that talks to the API over HTTP —
it does not import harness internals. Key endpoints:

- `POST /v1/ingest` — compile a research brief → plan + Dogma Gate
- `POST /v1/missions` — run a mission (add `?async=true` to enqueue an autonomous job)
- `GET  /v1/missions/:id` · `/report` · `/events` (SSE live telemetry)
- `POST /v1/jobs` · `GET /v1/jobs/:id` — autonomous job queue

Base URL defaults to `http://localhost:8080` (`HARNESS_API_URL`).

Shared ingest/plan/dogma logic lives in `../core`. See
`agents/plans/PLAN-FEATURE-3-UI-TEARDOWN.md` for the rationale.
