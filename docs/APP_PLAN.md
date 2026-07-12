# APP_PLAN — Hypothesis Validation & Clean CLI/App Architecture

**Authored:** 2026-07-12
**Status:** Design — Phase 1 implemented

> **UPDATE (veritas-v0.2 L-1):** The `app/src/lib/veritas/` layout described below (schema/dogma/eval
> **copied into the app**, "Copied, Not Imported", manual sync policy) is **historical**. On
> 2026-07-12 those files were moved to the repo-level [`core/`](../core/README.md) package and the app
> now imports them via the `@core/*` alias. The manual sync policy is replaced by an enforceable
> drift-guard test (`harness/veritas-example/src/ingest/contract-drift.test.ts`). See
> `docs/veritas-v0.2.md` C-1/M-3 and `docs/CURRENT_IMPLEMENTATION-2026-07-12.md` for the current shape.

---

## The Hypothesis

> STEP 1: Harness creation based on the intention of the user.  
> STEP 2: Performing missions within the harness.

---

## Validation Against the Existing System

The hypothesis maps exactly to the two primary flows already built in `harness/veritas-example/`.

### STEP 1 — Intention → Plan (already exists)

The user expresses intention through a structured brief. The ingest pipeline compiles it into a validated, machine-executable `research-plan.json`.

```
User intention (text brief)
  └─► bun run ingest          # compile brief → research-plan.json
        ├─ parse-intent.ts     # extract frontmatter + sections
        ├─ fit-intent.ts       # LLM maps intent to ResearchPlan schema
        ├─ validate.ts         # Zod schema enforcement
        └─ plan-eval.ts        # Dogma Gate: 8 dimensions must pass
             ├─ falsifiable-question   (required)
             ├─ bounded-scope          (required)
             ├─ phased-approach        (required)
             ├─ measurable-success     (required)
             ├─ honest-decomposition   (required)
             ├─ source-grounded        (advisory)
             ├─ specialist-alignment   (advisory)
             └─ reproducible-criteria  (advisory)
  └─► missions/<slug>/research-plan.json   ← STEP 1 output
```

**Verdict: CONFIRMED.** The ingest pipeline is STEP 1. It takes user intention and produces a harness-executable plan that has passed eight research-discipline gates.

### STEP 2 — Plan → Mission (already exists)

The harness takes the validated plan and runs a safe, scoped, evidence-grounded agent loop.

```
missions/<slug>/research-plan.json   ← STEP 1 output
  └─► bun run dev start --plan       # execute
        ├─ plan-eval.ts              # gate re-checked at execution time
        ├─ source-digest.ts          # digest sources into summaries
        ├─ agent/index.ts            # ReAct loop
        │    ├─ loadout resolution   # codebase-audit | research | web-recon
        │    ├─ specialist system prompt
        │    ├─ tool subset (read_file, list_dir, http_get, record_finding)
        │    └─ safety spine (scope → approval → evidence gate → refuter)
        └─► .veritas/runs/<id>/      ← STEP 2 output (snapshot, findings, transcript)

bun run dev status <id>    # one-line
bun run dev report <id>    # full markdown report
```

**Verdict: CONFIRMED.** `dev start --plan` is STEP 2. The same loop, gates, and ledger run unchanged regardless of the objective. Only loadout, tools, and target adapter differ.

### The Critical Separation

The hypothesis is proven correct by the architecture's composition property:

```
STEP 1 output (research-plan.json)
  = the interface between intention and execution
  = the only thing STEP 2 reads from STEP 1
```

Nothing else is shared. The ingest pipeline can be replaced entirely (by a UI, a CLI, an API) and STEP 2 is unaffected. The mission loop can evolve (new tools, new loadouts) and STEP 1 is unaffected.

---

## What the App and CLI Each Own

The validated hypothesis defines a clean ownership boundary.

| Responsibility | CLI | App |
|---------------|-----|-----|
| **STEP 1 — Express intention** | `bun run ingest -i` (interactive interview) | `/ingest` form: slug, objective, target, loadout, file |
| **STEP 1 — Headless/batch ingestion** | `bun run ingest -s slug -o "..." [--dir]` | `POST /api/v1/missions` (FormData) |
| **STEP 1 — Validate plan (Dogma Gate)** | `bun run dev eval --plan` | Inline gate results returned in POST response |
| **STEP 1 — Digest sources** | `bun run dev digest --plan` | Future (Phase 2: trigger via API) |
| **STEP 2 — Run mission** | `bun run dev start --plan` | Future (Phase 2: trigger via API → harness subprocess) |
| **STEP 2 — View status** | `bun run dev status <id>` | `/missions/<id>` — future (Phase 2: read from store) |
| **STEP 2 — View report** | `bun run dev report <id>` | `/missions/<id>/report` — future |
| **STEP 2 — Verify finding** | `bun run verify-finding` | Future |

**Phase 1 of the App owns STEP 1 exclusively.**  
The CLI owns STEP 2 throughout Phase 1 and remains the primary execution path indefinitely.

The App is never a replacement for the CLI. It is the human-facing interface to STEP 1.

---

## Architecture — No Unnecessary Abstractions

```
┌──────────────────────────────────────────────────────────────┐
│  CLI (harness/veritas-example/)                              │
│  bun run ingest [flags]   ← STEP 1, local, offline          │
│  bun run dev start --plan ← STEP 2, local, runs agent loop  │
│  bun run dev status/report                                   │
│                                                              │
│  Unchanged. No new flags in Phase 1.                         │
└──────────────────────────────────────────────────────────────┘
                        ↕ independent
┌──────────────────────────────────────────────────────────────┐
│  App (app/)                                                  │
│  Next.js 15 App Router, standalone (no workspaces)          │
│                                                              │
│  /ingest            ← STEP 1 form                           │
│  /missions/result   ← STEP 1 result (plan + gate scores)    │
│                                                              │
│  /api/v1/missions   ← POST: compile brief + dogma gate       │
│  app/src/lib/         types, schema copy, compile-brief      │
│                                                              │
│  Dependencies: zod, @anthropic-ai/sdk                        │
│  No Vercel AI SDK. No monorepo workspaces. No CLI changes.   │
└──────────────────────────────────────────────────────────────┘
```

---

## App — Implementation

### File Structure

```
app/
  src/
    app/
      page.tsx                       Home: two-step explanation + links
      ingest/
        page.tsx                     STEP 1 form
      missions/
        result/
          page.tsx                   STEP 1 result: plan JSON + gate scores
      api/
        v1/
          missions/
            route.ts                 POST handler
          missions/[id]/
            telemetry/route.ts       GET SSE stub (Phase 2)
    lib/
      veritas/
        schema.ts                    ResearchPlan Zod schema (copied, no harness import)
        dogma.ts                     8 dimension predicates (copied)
        eval.ts                      evalPlan(), evalPlanWithConfig() (copied)
        types.ts                     MissionPayload, ApiIngestResult
      compile-brief.ts               serverCompileBrief() using @anthropic-ai/sdk
      extract-json.ts                JSON extraction from model output (30 lines, ported)
  .env.example
  next.config.ts
  package.json
  tsconfig.json
```

### STEP 1 Form — `/ingest/page.tsx`

Four fields. Inline Dogma Gate errors on submit failure. No chat, no LLM in the UI layer.

```
┌─ What do you want to investigate? ──────────────────────────┐
│                                                             │
│  Mission name (slug)    [auth-audit              ]          │
│                                                             │
│  Objective              [Verify that the scope gate        ]│
│                         [blocks loopback by reading        ]│
│                         [src/safety/scope.ts line by line  ]│
│                                                             │
│  Target / scope         [src/safety/                ]       │
│                                                             │
│  Loadout                [research          ▼]               │
│                         codebase-audit                      │
│                         research                            │
│                         web-recon                           │
│                                                             │
│  Context file (opt.)    [Choose .md or .pdf   ] drag/drop  │
│                                                             │
│  [ Create Mission Plan ]                                    │
└─────────────────────────────────────────────────────────────┘
```

On submit: `POST /api/v1/missions` with `multipart/form-data`.

On **400 Dogma Gate failure** — inline errors under each relevant field:

```
✗ Objective — too short (18 chars < 25). Be specific about what you want to verify.
✗ Target — scope.paths and scope.hosts are both empty. Provide a directory or host.
```

On **200** — redirect to `/missions/result?slug=...` passing plan via URL state or sessionStorage.

### STEP 1 Result — `/missions/result/page.tsx`

```
┌─ Mission Plan: auth-audit ──────────────────────────────────┐
│                                                             │
│  Dogma Gate  ✅ PASS   Score: 87%                           │
│  ├─ falsifiable-question  ✅  objective is specific         │
│  ├─ bounded-scope         ✅  paths=src/safety/             │
│  ├─ phased-approach       ✅  2 phases defined              │
│  ├─ measurable-success    ✅  1 measurable criterion        │
│  ├─ honest-decomposition  ✅  phases appear truthful        │
│  ├─ source-grounded       ⚠️  no sources cited (advisory)  │
│  ├─ specialist-alignment  ✅  focused roles                 │
│  └─ reproducible-criteria ✅  external evidence             │
│                                                             │
│  Loadout:   research                                        │
│  Target:    src/safety/                                     │
│  Phases:    2                                               │
│                                                             │
│  ┌─ Run this mission ────────────────────────────────────┐  │
│  │  bun run dev start --plan missions/auth-audit/        │  │
│  │                     research-plan.json                │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  [ Download research-plan.json ]   [ Edit → back to form ] │
└─────────────────────────────────────────────────────────────┘
```

The "Run this mission" block shows the exact CLI command to execute STEP 2. The App does not run missions in Phase 1 — it hands off to the CLI explicitly.

### API Route — `POST /api/v1/missions`

```
Input:   multipart/form-data
         slug        string (required)
         objective   string (required)
         target      string (optional)
         loadout     "codebase-audit" | "research" | "web-recon" (optional, default: research)
         file        File (.md or .pdf, optional)

Logic:
  1. Parse FormData → validate with Zod (MissionPayload schema)
  2. If file provided: file.text() → UTF-8 string (in-memory, no FS write)
  3. Build brief text: frontmatter + objective + file content if present
  4. serverCompileBrief(payload) → ResearchPlan
     Uses @anthropic-ai/sdk, mirrors fit-intent.ts logic, retries up to 2×
  5. evalPlan(plan) from app/src/lib/veritas/eval.ts
  6. Gate fail → 400 { ok: false, error, violations: [{id, reason}] }
  7. Gate pass → 200 { ok: true, slug, plan }

Errors:
  400  Zod validation failure (missing required fields)
  400  Dogma Gate failure    (with violations array)
  422  compileBrief LLM failure
  500  Unexpected error
```

### `app/src/lib/veritas/` — Copied, Not Imported

These three files are direct copies of harness source. They contain no `node:fs`, no Bun-specific APIs, no harness imports. They are pure TypeScript that runs in both Node.js (Vercel) and Bun.

| App file | Copied from |
|----------|-------------|
| `lib/veritas/schema.ts` | `harness/veritas-example/src/ingest/schema.ts` |
| `lib/veritas/dogma.ts` | `harness/veritas-example/src/config/dogma.ts` |
| `lib/veritas/eval.ts` | `harness/veritas-example/src/resources/plan-eval.ts` |

**Sync policy:** the harness is the source of truth. If dogma dimensions change in the harness, copy the updated file to `app/src/lib/veritas/`. This is a manual step; automated sync is Phase 2.

---

## App Dependencies

```json
{
  "dependencies": {
    "next": "15.x",
    "react": "19.x",
    "react-dom": "19.x",
    "zod": "^4.4.3",
    "@anthropic-ai/sdk": "^0.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/node": "^26.x",
    "@types/react": "^19.x",
    "tailwindcss": "^4.x"
  }
}
```

No `ai` package. No `@ai-sdk/*`. No monorepo workspace config. The root `package.json` is unchanged.

---

## Phase Map

| Phase | What ships | CLI changes | App pages |
|-------|-----------|-------------|-----------|
| **1 (this plan)** | STEP 1 form + gate result | None | `/`, `/ingest`, `/missions/result`, `/api/v1/missions` |
| **2** | Mission status view; CLI `--api-url` flag | Add `--api-url` flag (additive) | `/missions/[id]` reads from store; SSE telemetry |
| **3** | Trigger STEP 2 from App | API route wraps `dev start` subprocess | `/missions/[id]` run button; live log stream |

---

## Verification Gates

```bash
# 1. Harness tests unchanged
cd harness/veritas-example && bun test
# → must stay green

# 2. App builds
cd app && bun run build
# → 0 TypeScript errors

# 3. API accepts valid plan
cd app && bun run dev &
curl -s -X POST http://localhost:3000/api/v1/missions \
  -F "slug=scope-study" \
  -F "objective=Verify the scope gate blocks loopback by inspecting src/safety/scope.ts line by line" \
  -F "target=src/safety" \
  -F "loadout=research" | jq .ok
# → true

# 4. API rejects vague objective
curl -s -X POST http://localhost:3000/api/v1/missions \
  -F "slug=vague" \
  -F "objective=Look at things" \
  -F "target=src/" | jq .violations
# → [{id: "falsifiable-question", reason: "..."}]

# 5. Form renders and submits
open http://localhost:3000/ingest
# Fill form → submit → /missions/result shows gate scores + CLI command

# 6. Download plan JSON
# → downloads valid research-plan.json consumable by bun run dev start --plan
```

---

## What Does Not Change

| Component | Reason |
|-----------|--------|
| `harness/veritas-example/src/ingest/cli.ts` | Fully built; no Phase 1 changes |
| `harness/veritas-example/src/cli.ts` | STEP 2 entry point; untouched |
| `harness/veritas-research/` | Template harness; untouched |
| Root `package.json` | No workspaces added |
| `harnesses.json` | Registry unchanged |
| `meta/` | Create-harness pipeline unchanged |
| Any `*.test.ts` | Must stay green; no harness imports touched |
