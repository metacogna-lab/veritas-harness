# Observability Stack Plan

## Purpose

Structured, machine-readable logs emitted during harness execution that can be:
1. Read back by the RSI loop to identify failure patterns
2. Indexed for cross-mission analytics (latency, tool hit rates, finding confidence)
3. Consumed by the future UI for live mission progress
4. Exported to external sinks (Pino → file, Loki, OTLP)

**Key constraint**: logs must be **brief, labeled, and self-contained** — each line meaningful without context from adjacent lines, sized for prompt ingestion without summarisation.

---

## Stack Overview

```
Harness Events
     │
     ▼
  EventBus (in-process, typed)
     │
     ├──▶ StructuredLogger  →  NDJSON per event → .veritas/runs/<id>/events.ndjson
     │                                          → stdout (when LOG_LEVEL=debug)
     │
     ├──▶ MetricsCollector  →  mission.metrics.json (at close)
     │
     └──▶ TraceEmitter      →  OTLP (optional, env-gated)
```

---

## Components

### 1. `EventBus` — `src/telemetry/bus.ts`

**Function**: Typed in-process pub/sub. All harness subsystems emit to the bus; consumers subscribe without coupling.

**Events** (typed union, exhaustive):
```ts
type HarnessEvent =
  | { kind: "mission.start";    missionId: string; slug: string; objective: string }
  | { kind: "mission.end";      missionId: string; status: "ok"|"error"; durationMs: number }
  | { kind: "step.propose";     missionId: string; step: number; action: string; tool: string }
  | { kind: "step.execute";     missionId: string; step: number; tool: string; riskTier: string }
  | { kind: "step.observe";     missionId: string; step: number; ok: boolean; tokens: number }
  | { kind: "tool.scope_deny";  missionId: string; tool: string; reason: string }
  | { kind: "tool.gate_deny";   missionId: string; tool: string; tier: string }
  | { kind: "finding.proposed"; missionId: string; findingId: string; confidence: number }
  | { kind: "finding.refuted";  missionId: string; findingId: string; reason: string }
  | { kind: "finding.confirmed";missionId: string; findingId: string }
  | { kind: "ingest.start";     slug: string }
  | { kind: "ingest.gate_pass"; slug: string; score: number }
  | { kind: "ingest.gate_fail"; slug: string; errors: string[] }
  | { kind: "provider.request"; provider: string; model: string; tokens: number }
  | { kind: "provider.error";   provider: string; error: string }
  | { kind: "safety.scope";     allowed: boolean; target: string }
```

**No business logic** — pure routing. EventEmitter3 (already a dep).

---

### 2. `StructuredLogger` — `src/telemetry/logger.ts`

**Function**: Subscribes to EventBus, serialises each event as one NDJSON line to an append-only file + optional stdout.

**Log line shape** (one JSON per line, ~120 chars target):
```json
{"t":"2026-07-12T03:10:00.000Z","lvl":"info","kind":"step.execute","missionId":"m_abc123","tool":"read_file","riskTier":"safe","step":3}
{"t":"2026-07-12T03:10:01.000Z","lvl":"warn","kind":"tool.scope_deny","missionId":"m_abc123","tool":"http_get","reason":"host not in scope"}
{"t":"2026-07-12T03:10:02.000Z","lvl":"error","kind":"provider.error","provider":"anthropic","error":"rate_limit"}
```

**Fields** (always present): `t` (ISO timestamp), `lvl` (debug/info/warn/error), `kind`  
**Optional fields**: appended per event type — never nested deeper than 1 level  
**Omit**: raw tool outputs, model completions, PII — keep each line auditable, not verbose

**Log levels by event**:
- `debug`: step.propose, provider.request
- `info`: mission.start/end, step.execute, step.observe, finding.proposed/confirmed, ingest.*
- `warn`: tool.scope_deny, tool.gate_deny, finding.refuted
- `error`: provider.error, mission.end(status=error)

**Output targets** (env-controlled):
```
LOG_FILE=.veritas/runs/<id>/events.ndjson   # default, always on
LOG_LEVEL=info                               # default; debug enables step.propose + provider.request
LOG_STDOUT=false                             # set true for local dev
OTEL_EXPORTER_OTLP_ENDPOINT=...            # enables TraceEmitter
```

---

### 3. `MetricsCollector` — `src/telemetry/metrics.ts`

**Function**: Accumulates per-mission counters from EventBus; writes `mission.metrics.json` at mission close.

**Schema**:
```ts
interface MissionMetrics {
  missionId:      string;
  slug:           string;
  durationMs:     number;
  steps:          number;
  toolCalls:      number;
  scopeDenials:   number;
  gateDenials:    number;
  findings:       { proposed: number; refuted: number; confirmed: number };
  tokens:         { total: number; byProvider: Record<string, number> };
  ingestScore:    number | null;
}
```

Written to `.veritas/runs/<id>/metrics.json`. Consumed by:
- `verify-claims.mjs` (token totals validation)
- RSI loop (`src/rsi/`) for pattern extraction
- UI for mission cards

---

### 4. `TraceEmitter` — `src/telemetry/trace.ts`

**Function**: Optionally exports OpenTelemetry spans when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. Maps HarnessEvents to spans:

- `mission.start` → root span `veritas.mission`
- `step.execute` → child span `veritas.step` with tool + riskTier attributes
- `finding.confirmed` → span event on root span

**Off by default** — zero cost when env var absent. Uses `@opentelemetry/sdk-node` (optional dep, loaded dynamically).

---

### 5. `LogReader` — `src/telemetry/reader.ts`

**Function**: Parse `events.ndjson` back into typed events for RSI / post-mission analysis. Used by:
- `src/rsi/` — mine failure patterns from logs
- `scripts/lessons.mjs` — extract lesson candidates from refuted findings + scope denials
- Future UI — replay mission timeline

**API**:
```ts
function readEvents(ndjsonPath: string): HarnessEvent[]
function filterEvents(events: HarnessEvent[], kinds: HarnessEvent["kind"][]): HarnessEvent[]
function summarise(events: HarnessEvent[]): MissionMetrics
```

---

## Integration Points

| Subsystem | Change |
|-----------|--------|
| `src/agent/index.ts` | Emit `step.propose`, `step.execute`, `step.observe` to bus |
| `src/safety/scope.ts` | Emit `tool.scope_deny`, `safety.scope` |
| `src/safety/approval.ts` | Emit `tool.gate_deny` |
| `src/evidence/gate.ts` | Emit `finding.proposed` |
| `src/evidence/refuter.ts` | Emit `finding.refuted`, `finding.confirmed` |
| `src/llm/index.ts` | Emit `provider.request`, `provider.error` |
| `src/control/plane.ts` | Emit `mission.start`, `mission.end`; init logger + collector |
| `src/ingest/cli.ts` | Emit `ingest.start`, `ingest.gate_pass`, `ingest.gate_fail` |

---

## File Layout

```
src/telemetry/
  bus.ts          EventBus — typed pub/sub (EventEmitter3 wrapper)
  logger.ts       StructuredLogger — NDJSON writer
  metrics.ts      MetricsCollector — per-mission counters
  trace.ts        TraceEmitter — OTLP spans (optional)
  reader.ts       LogReader — parse events.ndjson for RSI/UI
  types.ts        HarnessEvent union + MissionMetrics types
  index.ts        Re-exports bus, logger, metrics; initialises stack from env
```

---

## What This Enables (Future)

- **RSI**: `src/rsi/` reads `events.ndjson` to mine `scope_deny` and `gate_deny` patterns → proposes new scope rules
- **Lessons**: `scripts/lessons.mjs` flags missions with >N refuted findings as candidates for lessons extraction
- **UI**: WebSocket stream of events during live mission (bus → SSE endpoint in `src/mcp-server.ts`)
- **Cross-mission analytics**: `scripts/analyze.mjs` aggregates `metrics.json` across all runs into `analysis/research-analysis-*.md`

---

## Build Order

1. `src/telemetry/types.ts` — HarnessEvent union (no deps)
2. `src/telemetry/bus.ts` — EventBus (depends on: eventemitter3)
3. `src/telemetry/logger.ts` — StructuredLogger (depends on: bus, types, node:fs)
4. `src/telemetry/metrics.ts` — MetricsCollector (depends on: bus, types)
5. `src/telemetry/reader.ts` — LogReader (depends on: types)
6. `src/telemetry/trace.ts` — TraceEmitter (depends on: bus, types; OTEL optional)
7. `src/telemetry/index.ts` — wires stack from env
8. Integration: wire bus.emit() calls into agent loop, safety gates, evidence gates, LLM backbone
9. Tests: unit tests per module; integration test verifying events.ndjson is written for a minimal mission
