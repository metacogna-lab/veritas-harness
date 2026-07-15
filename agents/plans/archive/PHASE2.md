# PHASE2 — Interface Boundaries for Veritas 0.2

**Authored:** 2026-07-12
**Status:** Largely landed (2026-07-15 W1–W5; H-4 LoadoutRegistry codegen closed on feat/h4-from-spec-loadouts). W6 Modal remains staged.
**Method:** zoom-simplify L1→L4 applied as an analytical lens; grounded against current source.
**Companion:** severity-ranked issues in [`docs/veritas-v0.2.md`](../../docs/veritas-v0.2.md).

---

## 0. Framing

The system is a **bi-level machine** (confirmed by the research corpus, `harness-update-1107.md` §Synthesis):

```
OUTER LOOP  (slow, human-gated)   evolve the harness + base-scripts     ← RSI Engine
INNER LOOP  (fast, per-mission)   run missions under the current harness ← ReAct agent
```

Everything below defines the **narrow interfaces** between the parts of that machine. The
guiding rule (invariant #8, *compose don't fork*, extended to the whole repo): **every artifact
that crosses a boundary is a typed, versioned contract owned by exactly one module, with a
single direction of dependency.** Where two modules today hold private copies of the same
contract, that is a boundary violation to be closed, not a convenience to preserve.

The five boundaries the 0.2 work must make explicit:

| # | Boundary | Contract that crosses it | Current state |
|---|----------|--------------------------|---------------|
| B1 | CLI / UI → ingest | raw intent (`MissionPayload`) | **two implementations** (CLI `fitIntent`, App `serverCompileBrief`) |
| B2 | ingest → validation | `ResearchPlan` + `PlanEvalResult` | **duplicated** (`core/` vs harness, drifting) |
| B3 | ingest → harness | `research-plan.json` on disk (+ new `HarnessSpec`) | **manual/broken** (App plan is discarded) |
| B4 | harness template + base-scripts | `harness.json` manifest + `base-scripts/` API | base-scripts wired; `core/` **not** shared |
| B5 | inner loop → RSI engine | telemetry (`events.ndjson`) + `EditableSurface` | telemetry **not built**; RSI reads experience store |

---

## B1 — CLI / UI : Ingest and Process

### The boundary
A human (UI form) or an agent/operator (CLI) expresses **intent**; the ingest process turns it
into a candidate `ResearchPlan`. Intent is untrusted input; the boundary is a validation frontier.

### Current problem (L1 — architecture)
There are **two independent compilers** for the same step:

- CLI: `harness/veritas-example/src/ingest/fit-intent.ts` → `fitIntent()` (reads `TEMP.md` from disk, Bun runtime)
- App: `core/compile-brief.ts` → `serverCompileBrief()` (embeds the template inline, Node runtime)

They share no code. They can produce different plans from identical intent. This is the single
largest coupling/duplication defect in the repo.

### Target contract
One intent type, one compiler interface, two thin adapters.

```ts
// core/ingest/types.ts  (the ONE definition)
interface MissionPayload {
  slug: string;
  objective: string;
  target?: string;
  loadout?: LoadoutName;
  fileContent?: string;   // supplementary context, already read into memory
  fileName?: string;
}

// core/ingest/compile.ts  (the ONE compiler; runtime-agnostic)
//   - takes an injected LLM caller so it runs under Bun (CLI) or Node (App)
//   - embeds the template as a constant (no disk read) → portable
function compileBrief(
  payload: MissionPayload,
  llm: (system: string, user: string) => Promise<string>,
): Promise<ResearchPlan>;
```

- **CLI adapter** (`src/ingest/fit-intent.ts`): reduces to `compileBrief(payload, bunLLM)`.
- **App adapter** (`app/src/app/api/v1/missions/route.ts`): reduces to `compileBrief(payload, anthropicLLM)`.

The template stops being read from `TEMP.md` at runtime; it becomes a versioned constant next to
the compiler. `TEMP.md` remains as human-facing documentation only.

### Boundary invariants (unchanged, must hold on both paths)
- Intent text is **untrusted data** — the system prompt already says so; keep it in the shared compiler so both paths inherit it.
- The compiler **never writes to disk** — it returns a value. Persistence is the caller's decision (see B3).

---

## B2 — Contracts : the Verified & Validated Data Model

### The boundary
`ResearchPlan` is *the* interface between intention and execution (`APP_PLAN.md` names it "the
only thing STEP 2 reads from STEP 1"). The Dogma Gate is the validator that stamps a plan
"executable". Together they are the **verified & validated data model**.

### Current problem (L1 — architecture, CRITICAL)
The contract exists in **two copies that are already textually diverging**:

| Artifact | Copy A (app) | Copy B (harness) | State |
|----------|--------------|------------------|-------|
| schema | `core/schema.ts` (60 ln) | `src/ingest/schema.ts` (60 ln) | **differ** (comments + `ParsedResearchPlan` alias) |
| dogma | `core/dogma.ts` (124 ln) | `src/config/dogma.ts` (186 ln) | **differ in size**; IDs still match |
| eval | `core/eval.ts` (39 ln) | `src/resources/plan-eval.ts` (92 ln) | **differ** |

Sync policy today is *"manually copy the file"* (`APP_PLAN.md` §sync). There is **no test** that
asserts the two stay equal. The guarantee "a plan that passes the gate in the browser will pass
in the CLI" is therefore **unenforced and already eroding**. This is a silent-divergence trap:
the day the harness tightens `measurable-success` and the app doesn't, the UI will greenlight
plans the CLI rejects.

### Target contract: single source of truth
Promote the data model to one owner that **both** the app and every harness import.

```
core/                          ← rename intent: "the shared contract package", not "app helpers"
  schema.ts        ResearchPlan (Zod)             ← ONE definition
  dogma.ts         DEFAULT_DOGMA, buildDogma()    ← ONE definition
  eval.ts          evalPlan(), evalPlanWithConfig()
  ingest/          MissionPayload, compileBrief() (B1)
```

- `harness/veritas-example/src/ingest/schema.ts` → re-export from `core/schema.ts` (or delete and import).
- `harness/veritas-example/src/config/dogma.ts` → re-export from `core/dogma.ts`.
- App already imports `@core/*`. Harness imports via a relative path or a workspace alias.
- **Drift-guard test** (the enforceable version of the sync policy): a test in the harness that
  imports both the local dogma dimension-id set and `core`'s and asserts equality. If someone
  re-forks, CI goes red.

### Why this is safe
The line-count differences are currently cosmetic (brace style, comments, one type alias) — the
dimension IDs are identical. Consolidating now is low-risk; consolidating after real logic drift
is a migration. Do it while it's still cheap.

---

## B3 — Interfaces : Connecting Ingestion to the Meta-Harness

### The boundary
The seam between STEP 1 (a validated plan) and STEP 2 (a running mission). Today the concrete
interface is a file: `missions/<slug>/research-plan.json`, consumed by `ControlPlane.start({ plan })`
(`control/plane.ts:118`).

### Current problem (L3 — interface, HIGH)
1. **The App plan is thrown away.** The browser compiles a `ResearchPlan`, shows gate scores,
   then hands the user a CLI command that **re-runs ingest from scratch** (`APP_PLAN.md` §Phase 1
   limitation). The compiled plan never becomes the file the harness reads. The App→harness
   interface is not wired; it is a copy-paste handoff.
2. **`StartOptions` is an overloaded interface** (11 fields; `plan` silently overrides
   `objective`/`target`/`loadout`/`role`/`scope`). A caller can pass a `plan` *and* a conflicting
   `target`; the precedence is implicit. That is a leaky abstraction at the most important seam.

### Target contract
Make `research-plan.json` the *only* thing that crosses B3, and make writing it a first-class
step both paths share.

```ts
// core/plan-io.ts
function writePlan(dir: string, plan: ResearchPlan): string;   // → missions/<slug>/research-plan.json
function loadPlan(path: string): ResearchPlan;                 // validates on read (already exists in harness)
```

- **App**: on gate pass, `POST /api/v1/missions` calls `writePlan()` (Phase 2 of the app roadmap)
  so the compiled plan *is* the artifact the CLI/Modal later runs — no recompilation. Until the
  app can write to the harness filesystem (Modal/0.2), it returns the plan JSON for download and
  the user drops it in `missions/<slug>/`. Either way the plan is preserved, never recompiled.
- **Tighten `StartOptions`**: split into `StartFromPlan { plan }` and `StartAdHoc { objective,
  target, loadout? }` (a discriminated union). Removes the implicit-override ambiguity; the type
  system enforces exactly one intake mode.

### Boundary invariant
The gate runs **at the seam, on the harness side, every time** (`control/plane.ts:127` already
re-checks). The App gate result is advisory UX; the harness gate is authoritative. Keep it that
way — never let an App "PASS" bypass the harness re-check.

---

## B4 — @harness/ : Generated Harness (from ingestion requirements) + base-scripts

### The boundary
Two distinct creation acts are being conflated in the 0.2 framing and must be separated:

- **B4a — Harness creation from a *template*** (`bun run create-harness`): copies
  `meta/templates/harness-template/`, installs capability packs, registers in `harnesses.json`.
  This is **structure-driven**, not intention-driven.
- **B4b — Harness creation from *ingested requirements*** (the "generated harness based on the
  harness requirements from ingestion"): **does not exist today.** Ingestion produces a
  `ResearchPlan` for the *pre-existing* `veritas-example` harness; it never emits a spec that
  parameterises a *new* harness.

### Current problem (L1 — architecture, HIGH — conceptual gap)
The 0.2 intent ("STEP 1 = harness creation based on user intention") assumes ingestion drives
harness generation. The built system's STEP 1 is *plan* creation. The gap: there is no contract
between "what the user wants" and "what harness gets built" — only between "what the user wants"
and "what plan runs in the fixed example harness".

Additionally: **`core/` is not available to generated harnesses.** `meta/templates/` contains no
reference to `core/`; a freshly created harness gets private copies of schema/dogma/eval (the
same duplication as B2, now multiplied per harness). base-scripts *is* correctly shared; `core/`
is not.

### Target contract: `HarnessSpec` as the B4b interface
Introduce one new contract that ingestion can optionally emit and `create-harness` can consume:

```ts
// core/harness-spec.ts
interface HarnessSpec {
  name: string;                    // kebab-case, → harness/<name>/
  capabilities: string[];          // → capability packs to install
  loadouts: LoadoutSpec[];         // roles, tool allowlists, target-adapter kind
  tools: ToolSpec[];               // domain tools to scaffold as stubs
  scopeDefaults: MissionScope;     // default containment for the domain
}
```

- **`create-harness` becomes bimodal**: `--from-template` (today's path, unchanged) OR
  `--from-spec <harness-spec.json>` (new; the pipeline reads the spec instead of only substituting
  `__HARNESS_NAME__`). The 7 ordered stages (validate→scaffold→capabilities→manifest→register→
  install→test) are **reused unchanged**; only stage 2 (scaffold) gains a spec-driven variant.
- **`core/` joins the shared layer alongside base-scripts.** The harness template references
  `../../core/*` exactly as it references `../../base-scripts/*`. One schema, one dogma, repo-wide.
- **base-scripts stays the infra API** (`doctor`, `veritas-config`, `lib/stats`) — cross-cutting,
  no domain logic (its README rule). `core/` is the *contract* API; `base-scripts/` is the *tooling*
  API. Keep them distinct: contracts vs scripts.

### Boundary invariant
Generated harnesses **never** copy the data model. They import it. `harnesses.json` +
`harness/<name>/` remain the only registration contract (no `projects/` folder — `USE-CASES.md`).

---

## B5 — RSI Engine : Runtime Analysis → base-scripts & Harness Improvement

### The boundary
The outer loop consumes the inner loop's **execution history** and proposes bounded edits to the
things the inner loop runs: harness code **and** (new for 0.2) base-scripts.

### Current problem (L1 — architecture, HIGH — intent vs reality)
The 0.2 framing says *"RSI performs analysis at each runtime to improve base-scripts, as well as
how the harness runs."* The built RSI (`src/rsi/`) differs on three axes:

| Axis | 0.2 intent | Built today |
|------|-----------|-------------|
| Cadence | "at each runtime" (inline) | separate outer-loop command `bun run dev rsi` (offline) |
| Targets | base-scripts + harness | `specialists.ts`, `tools/`, `safety/scope.ts` — **base-scripts not an editable surface** |
| Input | runtime telemetry | post-mission experience store (`resources/experience/`) |
| Autonomy | implied continuous | dry-run, **human-gated apply** (invariant #5) |

Two of these are safe to close; one must be resisted.

### Target contract: telemetry is the inner→outer interface
The missing piece is the **telemetry contract** (`OBSERVABILITY_STACK.md`, not yet built). It is
the clean B5 boundary — the inner loop emits, the RSI engine reads, neither couples to the other.

```
inner loop  ──emit──▶  EventBus ──▶ events.ndjson   (the B5 interface: typed HarnessEvent union)
                                        │
RSI engine  ──read──────────────────────┘  mineWeaknesses(events) → patterns → proposals → HUMAN GATE
```

- **Build `src/telemetry/` first** (it is the prerequisite for "analysis at runtime"). `events.ndjson`
  is the versioned, machine-readable contract; `mineWeaknesses` already clusters — point it at the
  telemetry reader instead of only the experience store.
- **Add `base-scripts/` as an `EditableSurface`.** `EditableSurface` already exists in
  `src/rsi/types.ts`; register `base-scripts/doctor.mjs`, `veritas-config.mjs`, `lib/stats.mjs`
  as bounded-edit targets. This is the concrete meaning of "RSI improves base-scripts": base-scripts
  become proposal targets, edited via AST-bounded diffs (`ts-morph`/`diff` per `DEPENDENCIES.md`),
  validated against committed oracles, **surfaced as a diff for human release**.
- **"At each runtime" = emit at runtime, propose out-of-band.** Reconcile the cadence honestly:
  the inner loop *emits telemetry* on every step (cheap, safe, inline). The RSI engine *analyses
  and proposes* asynchronously. Applying an edit **stays human-gated** — invariant #5 is not
  negotiable and "at each runtime" must not be read as "auto-apply per mission". Make this explicit
  in code and docs so the phrase can't drift into an autonomy claim.

### Boundary invariants (hard)
- **Honest decomposition** (#7): the proposer always gets a truthful task description.
- **Human before consequence** (#5): no self-edit — to harness code *or* base-scripts — applies
  without `requireHumanRelease`. base-scripts becoming editable **raises** the blast radius
  (they run in every harness), so the human gate on base-scripts edits is *more* important, not less.
- **Provenance** (#3): only failures carrying an `evidenceRef` are minable (already enforced in
  `mineWeaknesses`); telemetry events must carry the same provenance so the outer loop can't act on
  confabulated failures.

---

## Second Step — Missions Run by the Spawned Harness (0.2)

Once B1–B5 hold, the mission-execution story for 0.2:

- **Sandbox:** harness spawned in a Docker container now; **Modal sandbox in 0.2** (do not build
  yet — three conflicting Modal designs exist today, see `docs/veritas-v0.2.md` H-3; consolidate to
  one before writing code).
- **Mission developed through conversation:** the ReAct loop (`src/agent/`) already is the
  conversational executor. The 0.2 addition is a **conversational intake** in front of ingest
  (interactive interview exists at `src/ingest/interview.ts`) feeding B1.
- **Telemetry generated + consumed by RSI:** the B5 `events.ndjson` contract is what makes the
  mission→RSI feedback real. Build telemetry (B5) before Modal (second step) — RSI needs the trace
  format stable before missions run remotely and stream it back.

### Deployment note
The harness runs through Claude Code / Hermes executing complex loops; Modal sandboxes are the
0.2 overlay. This document is a **review** — no Modal code is authored here. The prerequisite work
is boundary consolidation (B1–B2 duplication, B3 wiring, B5 telemetry), not new deployment surface.

---

## Sequencing (what unblocks what)

```
B2 (consolidate contract)  ─┬─▶  B1 (single compiler)  ─┬─▶  B3 (wire ingest→harness)
                            │                            │
                            └─▶  B4 (core/ shared, HarnessSpec)
B5-telemetry (events.ndjson) ───▶ B5-RSI (base-scripts as surface) ───▶ Second step (Modal + conversational mission)
```

Do the consolidation (B2) first: it is the cheapest now and the most expensive later, and every
other boundary depends on there being one contract to point at.
