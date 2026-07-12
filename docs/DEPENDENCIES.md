# External Library Dependencies — Research-Driven Analysis

**Date:** 2026-07-12
**Source:** Research corpus (8 papers, 2025–2026) × current architecture

> **STATUS (veritas-v0.2 H-2):** Every dependency below is **PLANNED** (Phase 2/3/4). None are
> installed yet. The `src/...` paths are **proposed targets**, not existing files. Two corrections
> to earlier drafts of this doc: the RSI implementation already exists at **`src/rsi/`** (not
> `src/self-improve/`), and the experience store already exists at
> **`src/mission/experience-store.ts`** (not `src/experience/`). Where a row below names
> `src/self-improve/*` or `src/experience/*`, read it as "the planned home for this dependency,
> which will integrate with the existing `src/rsi/` and `src/mission/experience-store.ts`."

---

## Method

Each dependency below is grounded in a specific research pattern from the corpus. Papers are cited inline. Dependency is only listed if it fills a gap the current stack cannot handle without it.

**Current stack (already wired, no action needed):**
`zod` · `eventemitter3` · `js-yaml` · `tsx` · `typescript` · Bun native (`readline/promises`, `node:fs`, `node:util`)

---

## Phase 2 — INT (Telemetry + Structured Logging)

### `pino` · npm · MIT

**Research driver:** `zhang-2025-ace` (ACE) shows context collapse from compressing logs into summaries — structured, accumulating, machine-readable records are the answer. `lee-2026-meta-harness` navigates execution traces as files. The observability stack plan requires NDJSON-per-event output at high throughput with minimal overhead.

**What it does:** Fastest Node/Bun JSON logger. Native NDJSON output. Level filtering, redaction, and destination streams without configuration ceremony.

**Why not native `console.log` + `JSON.stringify`:** Pino is 5–8× faster on hot paths (agent loop emits on every step), has built-in redaction for secrets, and its transport system allows async log draining without blocking the event loop.

**Where used:** `src/telemetry/logger.ts` — StructuredLogger subscribes to EventBus, passes each typed event to pino, which streams to `.veritas/runs/<id>/events.ndjson`.

```bash
bun add pino
```

---

### `@opentelemetry/sdk-node` + `@opentelemetry/exporter-otlp-proto` · npm · Apache-2.0

**Research driver:** `hu-2025-adas` and `zhang-2025-dgm` both emphasise that performance gaps across harness iterations must be measurable with fine-grained span-level timing, not just aggregate pass rates. The observability plan calls for optional OTLP export.

**What it does:** Industry-standard distributed tracing SDK. Instruments async spans across the agent loop. Exports to any OTLP-compatible backend (Grafana Tempo, Jaeger, Honeycomb).

**Off by default:** Loaded dynamically only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. Zero cost when absent.

**Where used:** `src/telemetry/trace.ts` — TraceEmitter.

```bash
bun add @opentelemetry/sdk-node @opentelemetry/exporter-otlp-proto
```

---

## Phase 3 — ADV (Experience Store + Harness Proposer)

### `ts-morph` · npm · MIT

**Research driver:** `zhang-2026-self-harness` (Self-Harness) demonstrates that the critical requirement for safe harness self-modification is **targeted, bounded AST-level edits** — not string substitution. Their ablation shows string-level rewriting collapses to 57.1% accuracy while AST-targeted edits maintain 66.7%. `zhang-2025-ace` independently shows the same degradation from monolithic text rewriting.

**What it does:** TypeScript AST manipulation via a high-level API wrapping the TypeScript compiler API. Enables the harness proposer to make surgical edits: rename a specialist's `focus` string, add a tool to an allowlist, tighten a scope predicate — without touching unrelated code.

**Why not string diff/patch:** String patches fail on whitespace, imports reordered by auto-formatters, or variable renames. AST edits are structure-preserving and verifiable before application.

**Where used:** `src/self-improve/harness-proposer.ts` — generates candidate edits as TypeScript AST transformations targeting `src/agent/specialists.ts`, `src/tools/registry.ts`, `src/safety/scope.ts`.

```bash
bun add ts-morph
```

---

### `@lancedb/lancedb` · npm · Apache-2.0

**Research driver:** `lee-2026-meta-harness` achieves its 4× token reduction precisely because the proposer **queries** the experience store (grep/semantic search) rather than loading all history into context. With 82 files/iteration and 10M+ tokens of navigable history, substring grep alone misses semantic matches across renamed variables or paraphrased objectives. `hu-2025-adas` maintains a growing archive indexed by capability scores for nearest-neighbour retrieval of similar prior agent designs.

**What it does:** Embedded vector database — runs entirely in-process, no server, persists to disk as Arrow/Lance files. Supports full-text + vector hybrid search. Bun-compatible.

**Where used:** `src/experience/index.ts` — indexes mission transcripts, findings, and failure clusters as vectors. The harness proposer queries: "find 5 missions where scope-deny rate exceeded 30%" or "find prior failure clusters similar to the current one."

**Alternative considered:** `vectra` (in-memory only, no persistence). Rejected: experience store must survive process restarts.

```bash
bun add @lancedb/lancedb
```

---

### `diff` · npm · BSD-4-Clause

**Research driver:** `zhang-2026-self-harness` and `zhang-2025-ace` both require that candidate harness edits be **auditable as minimal diffs** before human approval. The regression-gating step needs to show the operator exactly what changed between the current harness and the candidate.

**What it does:** Implements Myers diff algorithm. Produces unified diffs (standard patch format) from two strings or structured objects. Used to generate human-readable patch previews and to apply/revert patches programmatically.

**Where used:** `src/self-improve/harness-proposer.ts` (generate patch preview); `scripts/verify-harness-candidate.mjs` (show operator what changed).

```bash
bun add diff && bun add -d @types/diff
```

---

## Phase 3 — ADV (Quality-Diversity Archive)

### `arquero` · npm · BSD-3-Clause

**Research driver:** `zhang-2025-dgm` (DGM) and `hu-2025-adas` (ADAS) both maintain typed, queryable archives of agent variants with associated scores. DGM's open-ended archive ablation shows that removing it causes catastrophic forgetting — the archive must support structured queries like "all loadout variants with pass@1 > 0.6 on the research benchmark" and "loadouts by coverage of behavior space."

**What it does:** DataFrame library for JavaScript — zero native deps, runs in Bun. Enables column-oriented filtering, aggregation, and join queries over the harness variant archive without spinning up SQLite.

**Why not SQLite (`better-sqlite3`):** The archive is small (tens to low hundreds of entries), schema evolves as the harness gains new metrics, and Arquero DataFrames serialize cleanly to Arrow/JSON for LanceDB ingestion.

**Where used:** `src/experience/archive.ts` — manages the Quality-Diversity archive of tested loadout variants with scores, coverage metrics, and lineage.

```bash
bun add arquero
```

---

## Phase 4 — Skills / Meta (Self-Improvement Loop)

### `execa` · npm · MIT

**Research driver:** `zhang-2025-dgm` and `lee-2026-meta-harness` both sandbox candidate code execution in subprocesses with strict time limits. The weakness miner, harness proposer, and regression-gate validator all need to spawn `bun test`, `bun run bench`, and `tsc` as child processes with controlled timeouts and captured stdout/stderr.

**What it does:** Ergonomic subprocess execution for Node/Bun. Handles timeout enforcement, output streaming, non-zero exit detection, and cross-platform signal handling — without the footguns of raw `child_process.spawn`.

**Why not Bun.spawn directly:** Execa provides a Promise-based API with clean timeout + signal propagation that maps directly onto the harness's async/await style throughout `src/`.

**Where used:** `src/self-improve/validator.ts` — runs `bun test` + `bun run bench` against candidate harness configs; `scripts/verify-harness-candidate.mjs`.

```bash
bun add execa
```

---

## Phase 4 — Deployment (Modal)

### `modal` · PyPI · Apache-2.0  *(Python, not Bun)*

**Research driver:** Phase 2 Modal execution plan. Every paper that runs at scale uses containerised sandboxes (DGM, ADAS, Self-Harness all independently containerise generated/modified code). Modal provides this with per-second billing, Volume persistence for artifacts, and Secret injection for provider keys.

**What it does:** Python SDK for running serverless functions on Modal's GPU/CPU fleet. `modal.Function` wraps `bun run dev start`; `modal.Volume` persists mission artifacts; `modal.Secret` injects `ANTHROPIC_API_KEY`.

**Where used:** `modal/runner.py`, `modal/ingest_and_run.py`, `modal/status.py` (to be created in Phase 2 Modal milestone M1–M3).

```bash
pip install modal
modal setup
```

---

## Phase 4 — UI Backend (Status Polling)

### `hono` · npm · MIT

**Research driver:** The observability plan's EventBus → SSE endpoint path, and the Phase 2 Modal status poller, both need a minimal HTTP server that can stream events to the UI without pulling in Express's full middleware tree.

**What it does:** Ultra-lightweight web framework, Bun-native, ~14 KB. Handles SSE streams, JSON endpoints, and request validation with Zod integration.

**Where used:** Extension of `src/mcp-server.ts` — adds an `/events` SSE endpoint streaming EventBus events to the UI; a `/status/:id` JSON endpoint reading mission metrics.

```bash
bun add hono
```

---

## Summary Table

| Dependency | Phase | Pattern from Research | Size / Risk |
|-----------|-------|----------------------|-------------|
| `pino` | INT | Structured NDJSON logging (ACE, Meta-Harness) | 75 KB · mature |
| `@opentelemetry/sdk-node` | INT | Span-level timing across iterations (ADAS, DGM) | ~2 MB · optional |
| `@opentelemetry/exporter-otlp-proto` | INT | OTLP export | ~500 KB · optional |
| `ts-morph` | ADV | AST-level bounded harness edits (Self-Harness, ACE) | ~8 MB · wraps tsc |
| `@lancedb/lancedb` | ADV | Queryable experience store (Meta-Harness, ADAS) | ~15 MB · no server |
| `diff` | ADV | Auditable patch previews for human approval (Self-Harness) | 20 KB · trivial |
| `arquero` | ADV | Quality-Diversity archive queries (DGM, ADAS) | 800 KB · zero native |
| `execa` | Skills | Sandboxed subprocess with timeouts (DGM, Meta-Harness) | 30 KB · mature |
| `modal` (Python) | Deploy | Containerised mission execution (all scale papers) | PyPI |
| `hono` | UI | SSE event streaming + status API | 14 KB · Bun-native |

---

## What the Research Does NOT Justify

- **Vector embedding models (local):** `@xenova/transformers` adds 200 MB+ to the install. LanceDB's built-in text search is sufficient for the experience store at current scale. Revisit if archive exceeds 10K entries.
- **Message broker (Redis, RabbitMQ):** All papers use in-process archives or filesystems. Inter-process communication is not a current requirement; EventBus handles in-process fan-out.
- **Graph database:** No paper uses graph-structured history. Stick with LanceDB + Arquero until a concrete graph query is needed.
- **Reinforcement learning frameworks:** ThetaEvolve uses RL but its improvement is on model weights, not harness code. The Veritas harness improves by editing code, not by gradient updates. No RL framework is justified.
- **Heavy observability agents (Datadog, New Relic):** The NDJSON + optional OTLP pattern is sufficient and keeps the harness self-contained. External agents add ops complexity without research-backed benefit at current scale.
