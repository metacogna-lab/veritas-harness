# PLAN — Feature 3: UI Interface Abstraction & app/ Teardown

**Authored:** 2026-07-15
**Build order:** #4 (last — after the API layer exists to be the interface).
**Owner:** `app/`

---

## Objective

Abstract the UI interface away from the repo and reduce the `app/` placeholder to a
bare README. The concrete Phase-1 Next.js UI (pages, components, and an ingest API
route that duplicated `core/` logic) is removed because the interface is now the
**Feature-1 HTTP API** (`bun run serve`, `:8080`). Any future UI is a separate client
that talks to `/v1/*` — it does not live in this repo.

## Rationale

- **Duplication:** `app/src/app/api/v1/missions/route.ts` re-implemented ingest via
  `@core/compile-brief` + `@core/eval` + `@core/plan-io`. That path is now served by the
  harness API `POST /v1/ingest`, which drives the *same* pipeline through the configured
  provider. Keeping the Next.js copy means two ingest surfaces to maintain.
- **Leaf:** `app/` is a confirmed leaf — a repo-wide grep shows nothing under `harness/`,
  `core/`, `meta/`, or `base-scripts/` imports from `app/`. Removing it breaks nothing.
- **Separation of concerns:** the repo owns the harness + its API; the UI is a client
  concern. Abstracting it out keeps the harness dependency tree free of React/Next.

## Confirmed decision

`app/` is reduced to **README only** (plus its `.gitignore`). No Next.js shell is kept.

## Actions

- `git rm -r` the Next.js implementation: `app/src/`, `app/next.config.ts`,
  `app/postcss.config.mjs`, `app/tsconfig.json`, `app/tsconfig.tsbuildinfo`,
  `app/package.json`, `app/.env.example`, `app/bun.lock`, `app/next-env.d.ts`
  (and the untracked `app/node_modules`, `app/.next` build artifacts).
- Replace `app/README.md` with a short note: the UI is reserved; the interface is the
  harness API (`harness/veritas-example`, `bun run serve`, `/v1/*`); shared ingest/plan
  logic lives in `core/`.
- Keep `app/.gitignore`.
- `core/` is untouched — it remains the shared contract package, now consumed by the
  harness API (and any future external UI via HTTP), not by an in-repo Next.js app.

## Gate

- **G-exit:** repo-wide grep confirms no imports from `app/`; `core/` builds clean; the
  harness suite is unchanged; `app/` contains only `README.md` + `.gitignore`. Commit.

## Note for a future UI

A future UI is a standalone client (any framework) pointing at `HARNESS_API_URL`
(default `http://localhost:8080`). It uses: `POST /v1/ingest` (compile + gate),
`POST /v1/missions` (sync or `?async=true`), `GET /v1/missions/:id[/report]`,
`GET /v1/missions/:id/events` (SSE), and `POST/GET /v1/jobs`. It never imports harness
internals — the API is the contract.
