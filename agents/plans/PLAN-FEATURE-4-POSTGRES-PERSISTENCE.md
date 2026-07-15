# PLAN — Feature 4: PostgreSQL Persistence for Telemetry & Logs

**Authored:** 2026-07-15
**Build order:** #1 (foundational — API layer and job runner both persist through this).
**Owner module:** `harness/veritas-example/src/persistence/` + `src/telemetry/pg-sink.ts`

---

## Objective

Persist harness telemetry (the `HarnessEvent` stream) and structured logs to a PostgreSQL
database named **`veritas`**. When `ENVIRONMENT="dev"`, retain **only the current session's**
completed work (previous sessions are purged at boot); otherwise retain everything.

## Architecture fit

The telemetry stack already routes every event through an in-process `EventBus`
(`src/telemetry/bus.ts`) and an NDJSON `StructuredLogger`. This feature adds a **second
subscriber** — a `PgSink` — alongside the file logger. No producer changes: emit sites stay as-is.
Postgres becomes the queryable store the RSI loop / API read from (superseding file-scan for prod).

```
EventBus ──▶ StructuredLogger (NDJSON, existing)
        └──▶ PgSink (NEW) ──▶ postgres "veritas"
Session boot (dev) ──▶ purge prior sessions
```

## Data model (schema `public`, database `veritas`)

```sql
sessions(id uuid pk, environment text, started_at timestamptz, ended_at timestamptz)
missions(id text pk, session_id uuid fk, slug text, objective text, status text,
         snapshot jsonb, created_at timestamptz, updated_at timestamptz)
events(id bigserial pk, session_id uuid fk, mission_id text, kind text, level text,
       payload jsonb, created_at timestamptz)
logs(id bigserial pk, session_id uuid fk, mission_id text, level text, message text,
     created_at timestamptz)
```
Indexes: `events(mission_id)`, `events(kind)`, `events(session_id)`, `jobs(status)` (added in F2).

## Interfaces (module/function level)

- `src/persistence/pool.ts`
  - `getPool(): Sql` — lazy singleton `postgres(DATABASE_URL)` (postgres.js). `DATABASE_URL`
    default `postgres://veritas:veritas@localhost:5432/veritas`.
  - `closePool(): Promise<void>` — for graceful shutdown + tests.
- `src/persistence/migrate.ts`
  - `migrate(sql): Promise<void>` — idempotent `CREATE TABLE IF NOT EXISTS …` (no ORM).
- `src/persistence/session.ts`
  - `startSession(sql, env): Promise<string>` — insert a session row, return id.
  - `applyRetention(sql, env, currentSessionId): Promise<void>` — **if `env==="dev"`**,
    `DELETE FROM events/logs/missions/jobs WHERE session_id <> $current`; else no-op.
- `src/persistence/repo.ts`
  - `insertEvent(sql, sessionId, e: HarnessEvent): Promise<void>`
  - `upsertMission(sql, sessionId, snap: MissionSnapshot): Promise<void>`
  - `insertLog(sql, sessionId, missionId, level, message): Promise<void>`
  - `listEventsByMission(sql, missionId): Promise<HarnessEvent[]>` (RSI/API reader parity with `reader.ts`)
- `src/telemetry/pg-sink.ts`
  - `class PgSink { attach(bus): () => void }` — subscribes, `insertEvent` per event. **Non-throwing**
    (a DB failure must never break a mission — matches the file logger contract).
- `src/telemetry/index.ts` extension
  - `telemetryFromEnv(runDir?)` gains an optional pg sink when `DATABASE_URL` is set; file logger stays.

## Environment contract

| Var | Default | Meaning |
|-----|---------|---------|
| `DATABASE_URL` | `postgres://veritas:veritas@localhost:5432/veritas` | connection string |
| `ENVIRONMENT` | `prod` | `dev` ⇒ session-only retention (purge prior sessions at boot) |
| `PG_TELEMETRY` | auto | `false` disables the pg sink (file NDJSON still works) |

## Gates

- **G0 (entry):** telemetry stack green (F did land in v0.2); `postgres` dep added; docker-compose has a `postgres` service (db=`veritas`).
- **G1 — schema & pool:** `migrate()` creates all tables idempotently against a live pg; `getPool` connects. *Verify:* an integration test (skipped when `DATABASE_URL` absent) runs `migrate` twice with no error.
- **G2 — sink parity:** events emitted on a bus with `PgSink` attached appear in `events`; `listEventsByMission` returns them and `summarise()` yields the same `MissionMetrics` as the NDJSON `reader.ts`. *Verify:* parity test.
- **G3 — dev retention:** boot with `ENVIRONMENT=dev` after a prior session ⇒ prior session rows gone, current retained. Boot with `ENVIRONMENT=prod` ⇒ both retained. *Verify:* retention test.
- **G4 — non-throwing:** `PgSink` with a broken `DATABASE_URL` logs a warning and does **not** throw or fail a mission. *Verify:* fault-injection test.
- **G-exit:** `bun test` green (pg tests auto-skip without a DB); `docker compose up` starts pg + harness; migration runs at boot; unit suite unchanged count + new pg suite.

## Safety / invariants

- **Redaction:** payloads pass through `redact()` before insert — no secrets in the DB.
- **Non-throwing telemetry** (existing contract) preserved.
- **Provenance:** events keep their `mission_id` + `kind`, so the evidence/RSI chain is intact.

## Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Tests require a live DB | Guard pg tests behind `DATABASE_URL`; skip otherwise (CI provides a service container) |
| Connection storms | single lazy pool; `max` capped; closed on shutdown |
| `dev` purge deletes wanted data | purge only rows with a *different* session_id; current session always retained |
