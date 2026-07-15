# PLAN — Feature 2: Autonomous In-Container Job Runner

**Authored:** 2026-07-15
**Build order:** #3 (after Postgres + API).
**Owner module:** `harness/veritas-example/src/jobs/`

---

## Objective

Run jobs **autonomously inside the container**: a worker loop, launched with the container, picks
queued jobs off a durable queue and executes them via the harness **using the configured provider** —
no per-job human trigger — while every safety invariant (esp. human-release for consequential
terminal actions) still holds.

## Architecture fit

A job is a durable request to run one of the harness's existing pipelines. The runner is a thin
scheduler around `ControlPlane` / the ingest pipeline; it adds **durability + autonomy**, not a new
execution path (invariant #8). The queue is a Postgres table (Feature 4) — no external broker
(DEPENDENCIES.md explicitly rejects Redis/RabbitMQ; a pg-backed queue is durable and simple).

```
API POST /v1/missions?async  ─┐
scheduled/seeded plans        ─┼─▶ jobs table ──▶ JobRunner(poll) ──▶ ControlPlane.start()
                                                          └──▶ telemetry ▶ PgSink + result row
```

## Job model

```sql
jobs(id uuid pk, session_id uuid, type text, spec jsonb, status text,   -- queued|running|done|error|held
     result jsonb, error text, attempts int, created_at, started_at, finished_at)
```
`type ∈ { "mission" (spec: {planPath|plan} ), "ingest" (spec: {slug,objective,target}) }`.

## Interfaces (module/function level)

- `src/jobs/types.ts` — `Job`, `JobType`, `JobStatus`, `JobSpec` (discriminated union), `JobResult`.
- `src/jobs/queue.ts` (pg-backed)
  - `enqueue(sql, sessionId, type, spec): Promise<Job>`
  - `claimNext(sql): Promise<Job | undefined>` — atomic `UPDATE … SET status='running'
    WHERE id = (SELECT id FROM jobs WHERE status='queued' ORDER BY created_at
    FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *` (safe for concurrent workers).
  - `complete(sql, id, result)`, `fail(sql, id, error)`, `hold(sql, id, reason)`.
  - `get(sql, id)`, `list(sql, status?)`.
- `src/jobs/runner.ts`
  - `class JobRunner { start(): void; stop(): Promise<void> }` — poll loop (interval `JOB_POLL_MS`,
    default 1500) → `claimNext` → dispatch by type → `complete/fail`. Concurrency cap `JOB_CONCURRENCY`
    (default 1). Injectable `buildLLM`, `store`, `bus`, `sql` for tests.
  - `runMission(job)` → `ControlPlane.start({ plan })` with the **chosen provider**; a job that
    reaches `requireHumanRelease` is set `held` (invariant #5 — never auto-releases).
  - `runIngest(job)` → ingest pipeline → optionally enqueue a follow-on `mission` job.
- `src/server/routes/jobs.ts` (extends Feature 1)
  - `POST /v1/jobs` enqueue, `GET /v1/jobs` list, `GET /v1/jobs/:id` status/result.
- `src/server/index.ts`: instantiate + `runner.start()` unless `RUN_WORKER==="false"`.

## Autonomy vs. safety (the key boundary)

- **Autonomous:** the runner selects and starts jobs without a human per job.
- **Bounded:** it can only start pipelines that pass the Dogma Gate; each mission runs under the
  full safety spine. A consequential terminal action does **not** auto-execute — the job parks in
  `held` with a `HumanReviewPacket`, surfaced via `GET /v1/jobs/:id` for explicit release.
- `JOB_MAX_STEPS` and a per-job `timeout` bound runaway loops.

## Gates

- **G0 (entry):** Features 4 + 1 landed.
- **G1 — queue:** `enqueue`/`claimNext`/`complete`/`fail` round-trip; `claimNext` is atomic under two
  concurrent claims (only one wins). *Verify:* queue tests (pg-guarded).
- **G2 — runner (mission):** a seeded `mission` job executes via an injected scripted `ControlPlane`
  and lands `done` with a result snapshot; telemetry rows written. *Verify:* runner test.
- **G3 — human-gate:** a job whose mission hits `requireHumanRelease` lands `held`, **not** `done`,
  and is never auto-released. *Verify:* invariant test (the important one).
- **G4 — API:** `POST /v1/jobs` + `GET /v1/jobs/:id` reflect lifecycle; `/v1/missions?async=true`
  enqueues and returns a job id. *Verify:* route tests.
- **G5 — container:** worker starts with the container (`RUN_WORKER`); a queued job drains without
  a human. *Verify:* documented compose smoke.
- **G-exit:** `bun test` green incl. `jobs/*.test.ts`; worker autonomous in-container; held-gate proven.

## Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Autonomy bypasses human-release | `held` status + packet; test G3 pins it; apply stage unchanged |
| Poison job loops | `attempts` cap → `error`; per-job timeout; `JOB_MAX_STEPS` |
| Double-execution across workers | `FOR UPDATE SKIP LOCKED` atomic claim |
| Provider drift mid-run | provider resolved once at job start from config; recorded in `result` |
