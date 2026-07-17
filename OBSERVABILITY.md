# Observability

How Veritas emits, stores, and configures telemetry — and how that telemetry feeds the
Recursive Self-Improvement (RSI) loop. This is the operator-facing configuration guide; the
original design rationale lives in [`docs/OBSERVABILITY_STACK.md`](docs/OBSERVABILITY_STACK.md),
and production gaps are tracked in
[`agents/plans/deployment/01-observability-production-gaps.md`](agents/plans/deployment/01-observability-production-gaps.md).

## Principle: logs are RSI fuel, not just debugging output

Every log line is **brief, labeled, and self-contained** — meaningful on its own, sized for
prompt ingestion without summarization. Raw tool outputs and raw model completions are **never**
carried in telemetry; only structured, auditable facts. This is a deliberate design choice, not
an accident of formatting: the outer RSI loop reads this stream to find failure patterns, so it
must be queryable (`grep`/`jq`) and lossless at the fact level.

> This directly implements the dominant finding from the RSI research corpus: *queryable external
> history beats compressed in-context summaries*. See
> [`research/meta-analyses/2026-07-11-harness-architecture-rsi.md`](research/meta-analyses/2026-07-11-harness-architecture-rsi.md).

## Pipeline

```
Mission (inner loop)                          RSI (outer loop)
      │ emits HarnessEvent                          ▲
      ▼                                             │ reads
┌───────────────┐   ┌──────────────────┐    ┌───────────────────┐
│  EventBus     │──▶│ StructuredLogger │───▶│ .veritas/runs/<id>/│
│ (typed, in-   │   │  (NDJSON)        │    │   events.ndjson     │
│  process)     │   └──────────────────┘    └───────────────────┘
│               │   ┌──────────────────┐    ┌───────────────────┐
│               │──▶│ PgSink (optional)│───▶│ Postgres          │
│               │   └──────────────────┘    │  events / logs     │
└───────────────┘                           └───────────────────┘
      │ writes structured, queryable per-mission record
      ▼
┌────────────────────────────────────────────┐
│ Experience Store  resources/experience/<id>/│  ◀── the RSI substrate
│   harness-config.json  transcript  findings │
│   scores.json          failure-clusters.md  │
└────────────────────────────────────────────┘
```

Source: `harness/veritas-example/src/telemetry/` (`bus.ts`, `logger.ts`, `pg-sink.ts`,
`reader.ts`, `types.ts`) and `src/mission/experience-store.ts`.

## Event contract

Events are a flat, exhaustive typed union (`src/telemetry/types.ts`). Each maps to a severity
via `EVENT_LEVEL`:

| Event kind | Level | Meaning |
|---|---|---|
| `mission.start` / `mission.end` | info | lifecycle (`end` carries `status`, `durationMs`) |
| `step.execute` / `step.observe` | info | a tool call and its outcome (`ok`) |
| `tool.scope_deny` | warn | scope gate blocked a call (invariant #1) |
| `tool.gate_deny` | warn | approval gate blocked a tier (invariant #2) |
| `finding.proposed` | info | a candidate finding was raised |
| `finding.refuted` | warn | the refuter disproved a finding (invariant #4) |
| `finding.confirmed` | info | a finding survived refutation |
| `ingest.gate_pass` / `ingest.gate_fail` | info / warn | Dogma Gate result |
| `provider.error` | error | LLM provider failure |

`MissionMetrics` (also in `types.ts`) are per-mission counters derived from the stream —
`steps`, `scopeDenials`, `gateDenials`, `findings{proposed,refuted,confirmed}`, `providerErrors`
— consumed by RSI, `verify-claims`, and the UI.

## Configuration

All knobs are environment variables, resolved at server/mission boot
(`src/telemetry/index.ts`, `telemetryFromEnv`):

| Variable | Default | Effect |
|---|---|---|
| `LOG_FILE` | `<runDir>/events.ndjson` | Explicit NDJSON path. Overrides the per-run default. |
| `LOG_STDOUT` | `false` | `true` also streams events to stdout (dev/live-tail). |
| `VERITAS_RUNS_DIR` | `.veritas/runs` | Root for per-mission run dirs (transcript, findings, events). |
| `DATABASE_URL` | unset | When set, enables the Postgres sink (and the job queue/runner). |
| `PG_TELEMETRY` | `true` when a db is present | Set `false` to disable the Postgres sink even with a `DATABASE_URL`. |

Behavior notes:
- With **no** `DATABASE_URL` and **no** `LOG_FILE`, telemetry still lands at the per-run NDJSON
  default — telemetry is never silently dropped.
- An API/worker with a db but no `LOG_FILE` still gets **persisted** telemetry via the PgSink.
- Live per-mission telemetry is exposed over SSE at `GET /v1/missions/:id/events` (requires the
  bus; see the HTTP API). Jobs are poll-only — there is no job-level event stream.

Verify configuration and redaction with `bun run doctor` before a mission runs; secrets are
passed through `redact()` before any log line is written (never hardcode keys — see
`src/config/`).

## Observability → RSI linkage

This is the reason the telemetry contract is shaped the way it is. The chain is:

1. **Emit** — the inner loop emits `HarnessEvent`s; failures surface as `step.observe {ok:false}`,
   `tool.scope_deny`, `tool.gate_deny`, `finding.refuted`, `provider.error`.
2. **Persist to the experience store** — each mission writes a structured, queryable record under
   `resources/experience/<mission-id>/` (`writeExperienceEntry`): the harness-config snapshot,
   append-only transcript, findings with provenance, and benchmark scores.
3. **Mine weaknesses** — `src/rsi/weakness-mining.ts` reads **only grounded failures**
   (`readFailedCalls`) — a failure with no `evidenceRef` pointing at a real observation is
   dropped, because an ungrounded failure is itself a confabulation (**invariant #3, provenance
   before claim**). Grounded failures are clustered by a normalized signature and ranked by
   frequency, then written to `failure-clusters.md` in the store.
4. **Propose** — the RSI proposer reads `failure-clusters.md` + the config snapshot and generates
   minimal, targeted candidate edits (proposer/executor/validator roles stay separate).
5. **Regression-gate** — a candidate is benchmarked against the current baseline; promotion
   requires held-out improvement with no held-in regression.
6. **Human release** — no candidate is ever auto-promoted. A consequential change stops one step
   short and requires explicit human release (**invariant #5**). The RSI loop today runs
   **dry-run only** (`src/rsi/dry-run.ts`).

So observability is not a side-channel — it is the **inner→outer interface**. The `types.ts`
header states it directly: *the inner loop EMITS these; the outer loop (RSI) and the UI READ
them.* Losing or compressing telemetry would blind the self-improvement loop.

## Research confirmation

The approach is confirmed by the 2025–2026 RSI/meta-harness corpus
([meta-analysis](research/meta-analyses/2026-07-11-harness-architecture-rsi.md)):

- **Queryable external history beats compressed summaries.** Every high-performing system
  (Meta-Harness, DGM, ADAS) keeps an explicit, navigable store of execution traces rather than a
  summary fed into the next prompt. Veritas's NDJSON stream + experience store is exactly this.
- **Weakness mining over execution traces.** `zhang-2026-self-harness` clusters failed traces
  into recurring patterns to drive minimal edits — implemented here as `weakness-mining.ts` →
  `failure-clusters.md`.
- **Bi-level loop with role separation.** A slow outer loop improves the harness; a fast inner
  loop runs tasks. Telemetry is the documented interface between the two levels.
- **Validate before promotion; sandbox before modify.** The regression gate + human release +
  scope/approval gates match the papers' universal safety patterns — and fill the gap the papers
  leave open (formal bounds on permissible self-modification) with Veritas's invariants §1–7.

## Coverage plan — ensuring logs & observability are included

To guarantee observability is present and RSI-ready across every harness (not just
`veritas-example`), tracked in priority order:

1. **Emit-site coverage audit.** Assert every side-effecting path emits a `HarnessEvent` — no
   silent tool call, scope denial, or provider error. A test walks the tool registry and fails
   if a risk-tiered tool has no corresponding emit.
2. **Experience-store guarantee.** Every mission close writes a complete
   `resources/experience/<id>/` record (config snapshot + transcript + findings + scores). Fail
   the run if the record is incomplete — the outer loop depends on it.
3. **Promote telemetry into `core/spine`.** The telemetry plane currently lives in
   `veritas-example`; it belongs in the shared spine (`core/spine/telemetry/`) so every harness
   inherits it via `@spine/*`, consistent with invariant #8 (one canonical spine). Tracked
   alongside the `meta/templates/harness-template` spine migration.
4. **Retention & rotation.** Define NDJSON rotation and Postgres `events`/`logs` retention so the
   store stays queryable at scale (the research notes median 82 files / up to 10M tokens of
   history per iteration in comparable systems).
5. **Metrics endpoint.** Expose `MissionMetrics` and cross-mission aggregates over HTTP for the
   dashboard and for `verify-claims` reproducibility checks.

Each item lands with tests green; nothing is marked done on unverified claims (invariant #6,
reproduce before report).
