# Veritas 0.2 — Architecture Review, Fix Plan & Implementation Status

**Reviewed / revised:** 2026-07-12 (rev 2 — now an actionable plan with shipped status, not just a register).
**Scope:** Full architecture via `docs/`, `agents/plans/`, and source under `harness/`, `core/`, `app/`, `base-scripts/`, `meta/`.
**Method:** zoom-simplify L1→L4 (survey via `metrics.mjs`; assessment against real files).
**Companion:** boundary redesign in [`agents/plans/PHASE2.md`](../agents/plans/PHASE2.md).

This document has three layers: (1) **what shipped** this pass, (2) a **high-level plan** of the six
workstreams, (3) a **module/function-level plan** giving exact files, functions, and signatures for
every concern — the concrete fixes, whether landed or staged. The original severity findings are
retained at the end with status markers.

---

## 1. Implementation status

Legend: ✅ landed & tested · 🟡 staged (spec below; net-new subsystem or blocked on a dependency) · ⚪ accepted (no action).

| ID | Severity | Concern | Status | What changed / why staged |
|----|----------|---------|--------|---------------------------|
| C-1 | CRITICAL | Data model duplicated, unguarded | ✅ | drift-guard test locks `core/` ↔ harness (dogma id+required, schema fields); `core/README.md` documents vendoring |
| C-2 | CRITICAL | Two ingest compilers | ✅ guard · 🟡 unify | drift-guard asserts UNTRUSTED-DATA + JSON-only in both; full single-compiler unification staged (cross-runtime LLM interface) |
| M-1 | MEDIUM | `StartOptions` silent override | ✅ | conflict guard in `start()`; test added; typed union staged (B3) |
| M-2 | MEDIUM | `control/plane.ts` god module | ✅ | extracted `ControlPlane.finalize()` (refuter + persist + experience write) |
| M-3 | MEDIUM | `core/` not shared / misnamed | ✅ doc · 🟡 template | `core/README.md` names it the contract SoT + drift-guard; template wiring staged (B4) |
| M-4 | MEDIUM | Telemetry env vars shown active | ✅ | `OPERATIONS_PLAN §12` rows badged *(planned)*; §8 PLANNED banner |
| H-2 | HIGH | Docs cite non-existent modules | ✅ | `DEPENDENCIES.md` status banner + path corrections (rsi/, mission/experience-store) |
| H-3 | HIGH | Three conflicting Modal designs | ✅ | canonical = `OPERATIONS_PLAN §7`/`PHASE2_MODAL_EXECUTION.md`; `STATIC_DEPLOYMENT.md` Modal marked superseded |
| L-1 | LOW | `APP_PLAN.md` stale `app/src/lib/` | ✅ | update banner → points at `core/` |
| L-3 | LOW | Overlapping deployment docs | ✅ partial | Modal sections cross-linked to canonical; full doc merge staged |
| H-1 | HIGH | App plan discarded at seam | 🟡 | `core/plan-io.ts` spec below; write-back needs harness FS access (Modal/0.2) |
| H-4 | HIGH | No harness-from-ingestion | 🟡 | `HarnessSpec` + bimodal `create-harness` spec below (net-new) |
| H-5 | HIGH | RSI can't edit base-scripts; cadence | 🟡 | language reconciled (B5); telemetry + editable-surface spec below (net-new) |
| M-5 | MEDIUM | `cli.ts main()` 142-ln dispatcher | 🟡 | **deliberately deferred**: `cli.ts` has no test; refactoring untested hot code exceeds its Low value. Spec below |
| L-2 | LOW | Deep nesting in parse/mcp | ⚪ | accepted — inherently branchy; revisit only if extended |

**Test result after this pass:** `veritas-example` 248 pass (was 243; +4 drift-guard, +1 M-1 guard, −0), `veritas-research` unchanged, `app` builds clean. No behaviour changed except the new `start()` conflict guard (previously-silent contradictions now error).

---

## 2. High-level plan (six workstreams)

```
W1  Consolidate the contract        C-1, C-2(guard), M-3          ✅ landed
W2  Doc-truth pass                   H-2, H-3, M-4, L-1, L-3       ✅ landed
W3  Harden the ingest→exec seam      M-1, M-2                      ✅ landed
     └─ typed union + write-back      B3, H-1                       🟡 staged
W4  Telemetry (inner→outer contract) H-5 (build src/telemetry/)    🟡 staged — prerequisite for runtime RSI
W5  Self-extension & RSI surfaces    H-4 (HarnessSpec), H-5 (base-scripts editable)  🟡 staged
W6  Second step (Modal sandboxes)    — out of scope this review, gated on W1–W5
```

The dependency spine: **W1 unblocks everything** (one contract to point at) → W3 seam → W4 telemetry
(the inner→outer interface) → W5 (RSI consumes telemetry, edits surfaces incl. base-scripts) → W6
(missions run remotely and stream telemetry back). W1–W3 landed this pass; W4–W5 are specified below;
W6 is explicitly not authored.

---

## 3. Module / function-level plan

### W1 — Consolidate the contract (C-1, C-2, M-3) — ✅ landed

**Landed:**
- `harness/veritas-example/src/ingest/contract-drift.test.ts` *(new)* — the enforceable sync policy.
  - `dogmaDimensions(src)` → sorted `{id, required}[]` via regex; asserts `core/dogma.ts` ≡ `src/config/dogma.ts`.
  - `schemaTopFields(src)` → top-level Zod keys; asserts `core/schema.ts` ≡ `src/ingest/schema.ts`.
  - asserts both `core/compile-brief.ts` and `src/ingest/fit-intent.ts` contain `UNTRUSTED DATA` + a "json object" constraint.
  - Text-based (no cross-package import) → zero module-resolution/dependency risk; runs under `bun test`.
- `core/README.md` *(new)* — names `core/` the repo-level contract SoT; documents the deliberate
  vendored-copy pattern for Docker isolation and the drift-guard that makes it safe.

**Staged — C-2 full unification (🟡):** the two compilers still have separate bodies because they
target different runtimes: harness `fitIntent` uses `LLMBackbone.complete()` (Bun); app
`serverCompileBrief` uses the Anthropic SDK (Node). Unify by extracting the runtime-agnostic core:

```ts
// core/ingest-contract.ts  (new — dependency-free strings)
export const INGEST_SYSTEM_PROMPT: string;   // the one canonical system prompt (untrusted-data + JSON-only)
export const INGEST_JSON_TEMPLATE: string;   // the one plan template (replaces TEMP.md disk read + app inline copy)

// core/ingest/compile.ts  (new)
export type LlmCall = (system: string, user: string) => Promise<string>;
export function compileBrief(payload: MissionPayload, llm: LlmCall): Promise<ResearchPlan>;
//   - builds prompt from INGEST_SYSTEM_PROMPT + INGEST_JSON_TEMPLATE
//   - parseLastObject → researchPlanSchema.safeParse → retry ×2
```
Then `core/compile-brief.ts` becomes `compileBrief(p, anthropicCall)` and harness `fit-intent.ts`
becomes `compileBrief(p, backboneCall)` (harness keeps a vendored `compile.ts`, drift-guarded).
*Effort:* ~1 focused pass; *risk:* touches the app build and harness ingest — do it isolated.

### W2 — Doc-truth pass (H-2, H-3, M-4, L-1, L-3) — ✅ landed

- `docs/DEPENDENCIES.md` — status banner: all deps PLANNED; corrected `src/self-improve/*`→`src/rsi/*`, `src/experience/*`→`src/mission/experience-store.ts`.
- `docs/OPERATIONS_PLAN.md` — §8 PLANNED banner; §12 env rows badged *(planned)*.
- `docs/PHASE2_MODAL_EXECUTION.md` — marked the canonical Modal design; disambiguated from `agents/plans/PHASE2.md`.
- `docs/STATIC_DEPLOYMENT.md` — Approach B (Modal) marked superseded, cross-linked to canonical.
- `docs/APP_PLAN.md` — banner: `app/src/lib/` layout is historical; app now imports `core/`.

### W3 — Harden the ingest→execution seam (M-1, M-2) — ✅ landed; typed end-state 🟡

**Landed:**
- `ControlPlane.start()` (`src/control/plane.ts`) — M-1 conflict guard: throws if an explicit
  `objective`/`target` **contradicts** the plan (consistent duplicates, as the CLI passes, are fine).
  New test `plane.test.ts::"start rejects an explicit objective that contradicts the plan"`.
- `ControlPlane.finalize(mission, loadout, scope, emit)` (`src/control/plane.ts`) — M-2 extraction of
  the post-run block (refute → snapshot → experience write). `start()` now reads as propose→run→finalize.

**Staged (B3 / H-1):**
- Typed intake — replace `StartOptions` with `type StartInput = StartFromPlan | StartAdHoc` (discriminated
  on presence of `plan`); update `cli.ts` (both harnesses) to pass exactly one variant, and the 5 test
  call sites. Makes the conflict guard a compile-time guarantee. *Deferred:* wide call-site churn with
  no `cli.ts` test — do it with the CLI verb-table refactor (M-5) so both land under one review.
- `core/plan-io.ts` *(new)* — `writePlan(dir, plan): string` (→ `missions/<slug>/research-plan.json`) and
  `loadPlan(path): ResearchPlan`. App `POST /api/v1/missions` calls `writePlan()` on gate pass so the
  browser-compiled plan **becomes** the file the CLI/Modal runs (no recompilation, closes H-1). Blocked
  until the app can reach a harness-visible filesystem (Modal Volume in 0.2); until then the result
  page's downloaded JSON is already a valid runnable plan — verify + document as the interim path.

### W4 — Telemetry: the inner→outer contract (H-5, build) — 🟡 staged

Build first; it is the interface the RSI engine consumes and the format sandboxed missions stream back.
Spec (from `OBSERVABILITY_STACK.md`, now correctly badged PLANNED):

```
src/telemetry/
  types.ts    HarnessEvent union (mission.*, step.*, tool.scope_deny, finding.*, provider.*, ingest.*)
              + MissionMetrics                                   ← pure types, zero dep, zero risk
  bus.ts      class EventBus { emit(e: HarnessEvent); on(kind, fn) }   (eventemitter3 — already installed)
  logger.ts   StructuredLogger.subscribe(bus) → NDJSON → .veritas/runs/<id>/events.ndjson
  metrics.ts  MetricsCollector.subscribe(bus) → mission.metrics.json at close
  reader.ts   readEvents(path): HarnessEvent[]; filterEvents(...); summarise(...): MissionMetrics
```
Integration (the risky part — do after the modules + their unit tests are green): emit calls in
`agent/index.ts` (step.*), `safety/*` (deny events), `evidence/*` (finding.*), `llm/index.ts`
(provider.*), `control/plane.ts` (mission.*). Keep emit non-throwing so telemetry can never fail a
mission. *Order:* types→bus→logger→reader→metrics→integration, one file + test at a time.

### W5 — Self-extension & RSI editable surfaces (H-4, H-5) — 🟡 staged

**H-4 — harness from ingestion.** New contract + bimodal pipeline (reuses the 7 stages):
```ts
// core/harness-spec.ts (new)
interface HarnessSpec {
  name: string; capabilities: string[];
  loadouts: { name: string; specialists: {role:string;focus:string}[]; toolNames: string[]; adapter: "path"|"host" }[];
  tools: { name: string; riskTier: string }[];       // scaffolded as typed stubs
  scopeDefaults: { hosts: string[]; paths: string[] };
}
```
- `meta/create-harness.ts` — add mode flag: `createHarness(name, { fromSpec?: HarnessSpec })`. Stage 2
  (scaffold) gains a spec-driven variant that writes `loadouts.ts`, tool stubs, and `harness.json` from
  the spec instead of only substituting `__HARNESS_NAME__`. Stages 1,3–7 unchanged.
- Optional ingest bridge: `src/ingest/to-harness-spec.ts` — derive a `HarnessSpec` from a `ResearchPlan`
  when the intent implies a new domain (kept explicit; never silent).

**H-5 — base-scripts as an RSI editable surface (with reconciled cadence).**
- `src/rsi/run.ts` — extend `editableSurfaces` to include `base-scripts/doctor.mjs`,
  `veritas-config.mjs`, `lib/stats.mjs` as `EditableSurface` entries (type already exists in
  `src/rsi/types.ts`). Proposals target them via AST-bounded diffs (`ts-morph`/`diff`).
- Point `mineWeaknesses` at the W4 telemetry `reader.ts` in addition to the experience store.
- **Cadence reconciled (do not regress invariant #5):** *emit* telemetry at runtime (inline, cheap),
  *propose* asynchronously, *apply only via* `requireHumanRelease`. base-scripts run in **every**
  harness, so their human gate matters more, not less. Encode this as a comment + test in `apply.ts`
  so "at each runtime" can never drift into an auto-apply claim.

### M-5 — CLI verb table — 🟡 deliberately deferred

`cli.ts main()` (142 ln) → `const handlers: Record<Verb, (ctx: CliCtx) => Promise<number>>` with one
small function per verb. **Deferred, not forgotten:** `cli.ts` has no test; refactoring untested hot
code is higher risk than its Low value. Bundle it with the B3 typed-intake change so a single review
covers both CLI edits, and add a minimal `cli.test.ts` (verb dispatch + exit codes) first.

---

## 4. Detailed findings (retained, with status)

> Evidence and impact unchanged from rev 1; each now carries its resolution.

- **C-1 ✅** — schema/dogma/eval duplicated `core/` vs harness with a manual sync policy and no test.
  *Fixed:* text-based drift-guard test + `core/README.md`. The copies were still behaviourally
  equivalent (dimension id+required parity) — consolidating the *guarantee* now, while cheap.
- **C-2 ✅ guard / 🟡 unify** — two compilers. *Guarded:* both must retain UNTRUSTED-DATA + JSON-only.
  *Staged:* `core/ingest-contract.ts` + `compileBrief(payload, llm)` (W1).
- **H-1 🟡** — App plan discarded. *Staged:* `core/plan-io.ts::writePlan`; interim = runnable download.
- **H-2 ✅** — `DEPENDENCIES.md` banner + path fixes; `OPERATIONS_PLAN §8` PLANNED.
- **H-3 ✅** — canonical Modal = `OPERATIONS_PLAN §7`/`PHASE2_MODAL_EXECUTION.md`; `STATIC_DEPLOYMENT` superseded.
- **H-4 🟡** — no harness-from-ingestion. *Staged:* `HarnessSpec` + bimodal `create-harness` (W5).
- **H-5 🟡** — RSI can't edit base-scripts; cadence. *Reconciled* in text; *staged* telemetry + editable surface (W4/W5).
- **M-1 ✅** — silent `plan` override → conflict guard + test; typed union staged (B3).
- **M-2 ✅** — god module → `finalize()` extracted.
- **M-3 ✅ doc** — `core/` documented as SoT + guard; template wiring staged (B4).
- **M-4 ✅** — env rows badged *(planned)*.
- **M-5 🟡** — deferred with reasoning (untested CLI).
- **L-1 ✅** — `APP_PLAN.md` banner.
- **L-2 ⚪** — accepted.
- **L-3 ✅ partial** — Modal sections cross-linked; full deployment-doc merge staged.

---

## 5. What is genuinely strong (keep)

- **The two-step model holds** — `ResearchPlan` as the single seam is the right spine; the harness
  re-gates at the seam (`control/plane.ts`). The drift-guard now protects that spine's contract.
- **Safety invariants are code, not convention** — scope, approval, evidence, refuter, human-release,
  all tested. The v0.2 work preserves this: the M-1 guard and the RSI cadence reconciliation both
  *strengthen* the invariants rather than relax them.
- **Many small, cohesive files** — still no 400+ line file. `finalize()` extraction keeps it that way.
- **base-scripts sharing is the correct pattern** — `core/README.md` now points `core/` at the same model.

---

## 6. Validation

- `cd harness/veritas-example && bun run build && bun test` → tsc clean, **248 pass / 0 fail**.
- `cd app && bun run build` → clean (7 routes).
- New behaviour is limited to the `start()` conflict guard (contradictory plan+explicit fields now
  error with a clear message); everything else is additive (tests, docs) or a behaviour-preserving
  extraction (`finalize()`). Self-review: every landed change traces to a file:function above and is
  covered by a test or is documentation.
