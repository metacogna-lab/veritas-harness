# Current Implementation — 2026-07-12

> This document describes the exact workflow, folder structure, and function-level notes for the Veritas meta-harness as of 2026-07-12. It is intended for external agent analysis.

---

## Two-Step Program Model

The system is built around a strict two-step model:

```
STEP 1 — Intention → Plan
  user writes a research brief  →  ingest pipeline  →  research-plan.json
  (validated by Dogma Gate: 8 research-discipline dimensions)

STEP 2 — Plan → Mission
  research-plan.json  →  dev start --plan  →  ReAct agent loop  →  findings
  (controlled by safety spine: scope → approval → evidence → refuter)
```

The `research-plan.json` is the stable contract between STEP 1 and STEP 2. It is produced by STEP 1 (via the CLI ingest command or the web app) and consumed by STEP 2 (via `dev start --plan`).

---

## Repository Root Structure

```
veritas/
├── core/                       ← shared domain abstractions (new, repo-level)
│   ├── schema.ts               ← ResearchPlan Zod schema + types
│   ├── dogma.ts                ← 8 Dogma Gate dimension definitions
│   ├── eval.ts                 ← evalPlan(), evalPlanWithConfig() — pure functions
│   ├── types.ts                ← MissionPayload, ApiIngestResult, ApiIngestSuccess, ApiIngestError
│   ├── extract-json.ts         ← parseLastObject(text) — robust JSON extraction
│   └── compile-brief.ts        ← serverCompileBrief(payload) — LLM plan compiler
│
├── app/                        ← Next.js 15 web frontend (UI ONLY)
│   ├── src/
│   │   └── app/
│   │       ├── layout.tsx      ← root layout, "VERITAS" brand header
│   │       ├── page.tsx        ← home page — two-step explanation + quick facts
│   │       ├── globals.css     ← Tailwind v4 dark theme
│   │       ├── ingest/
│   │       │   ├── page.tsx    ← server component wrapper (metadata + IngestForm)
│   │       │   └── IngestForm.tsx   ← "use client" — mission intake form
│   │       ├── missions/
│   │       │   └── result/
│   │       │       ├── page.tsx     ← Suspense boundary wrapper
│   │       │       └── ResultView.tsx  ← "use client" — gate score + CLI handoff
│   │       └── api/
│   │           └── v1/
│   │               └── missions/
│   │                   ├── route.ts          ← POST handler (STEP 1 endpoint)
│   │                   └── [id]/telemetry/
│   │                       └── route.ts      ← GET handler (Phase 2 stub: SSE)
│   ├── package.json            ← next, react, @anthropic-ai/sdk, zod, tailwindcss
│   ├── tsconfig.json           ← paths: @/* → ./src/*, @core/* → ../core/*
│   ├── next.config.ts          ← webpack alias for @core → ../core; module resolution fix
│   ├── postcss.config.mjs      ← @tailwindcss/postcss (Tailwind v4)
│   └── .env.example            ← ANTHROPIC_API_KEY, VERITAS_MODEL
│
├── harness/
│   ├── veritas-research/       ← pure 8-plane template harness (no domain logic)
│   └── veritas-example/        ← research domain harness (full: ingest, RSI, bench)
│
├── harnesses.json              ← ordered harness registry
├── meta/                       ← meta CLI: create-harness, list-harnesses, doctor
├── skills/                     ← generic meta skills (operate/create ANY harness)
├── agents/                     ← operating workspace (config, docs, plans, state)
│   ├── config/agents-config.md ← operating mandate — re-read every session
│   ├── plans/                  ← session plans (UI_APP.md, APP_PLAN.md, etc.)
│   └── state/                  ← session state and build log
└── CLAUDE.md                   ← project instructions for Claude Code
```

---

## core/ — Shared Domain Abstractions

All files are pure TypeScript with no harness-specific imports. They are consumed by both the web app (via `@core/*` webpack alias) and can be imported by any future CLI tool.

### `core/schema.ts`
- **Exports:** `researchPlanSchema` (Zod), `ResearchPlan` (type), all sub-schemas
- **Purpose:** Single source of truth for the research-plan data contract
- **Key shape:** `{ version, metadata, objective, loadout, target, scope, specialists, phases, sources, lessons, successCriteria }`
- **Deps:** `zod` only

### `core/dogma.ts`
- **Exports:** `DogmaDimension`, `DogmaConfig`, `DEFAULT_DOGMA`, `buildDogma(cfg?)`
- **Purpose:** 8 research-discipline gate dimensions. `buildDogma(cfg?)` merges config overrides with defaults
- **Dimensions (5 required):** `objective-specificity`, `scope-definition`, `specialist-coverage`, `phase-decomposition`, `success-measurability`
- **Dimensions (3 advisory):** `source-breadth`, `lesson-integration`, `temporal-framing`
- **Deps:** `./schema`

### `core/eval.ts`
- **Exports:** `evalPlan(plan, dogma?)`, `evalPlanWithConfig(plan, cfg?)`, `PlanEvalResult`, `DimensionResult`
- **Purpose:** Run all dogma dimensions against a plan; return pass/fail per dimension + aggregate score
- **`evalPlanWithConfig(plan, cfg?)`:** convenience wrapper — builds dogma from config, then calls evalPlan
- **Deps:** `./schema`, `./dogma`

### `core/types.ts`
- **Exports:** `MissionPayload`, `ApiIngestResult`, `ApiIngestSuccess`, `ApiIngestError`
- **`MissionPayload`:** `{ slug, objective, target?, loadout?, fileContent?, fileName? }`
- **`ApiIngestSuccess`:** `{ ok: true, slug, plan, score, dimensions }`
- **`ApiIngestError`:** `{ ok: false, error, violations? }`
- **Deps:** `./schema` (for `ResearchPlan`, `DimensionResult` types)

### `core/extract-json.ts`
- **Exports:** `parseLastObject(text): Record<string, unknown> | null`
- **Purpose:** Robust JSON extraction from LLM model output — strips fences, tries direct parse, then scans for last balanced `{...}` span
- **Deps:** none

### `core/compile-brief.ts`
- **Exports:** `serverCompileBrief(payload: MissionPayload): Promise<ResearchPlan>`
- **Purpose:** Compile a user's research intention into a validated ResearchPlan via LLM
- **How it works:**
  1. Builds a structured prompt with JSON template + intent fields
  2. Calls `@anthropic-ai/sdk` (`claude-sonnet-4-6` or `VERITAS_MODEL` env)
  3. Extracts JSON from model output via `parseLastObject`
  4. Validates with `researchPlanSchema.safeParse()`
  5. Retries up to 2× on validation failure, feeding errors back into prompt
- **Security:** SYSTEM_PROMPT marks intent text as UNTRUSTED DATA — model instructed not to follow instructions embedded in user content
- **Deps:** `@anthropic-ai/sdk`, `./schema`, `./extract-json`, `./types`

---

## app/ — Next.js 15 Frontend (UI Only)

### Path Aliases
- `@/*` → `app/src/*` — app-internal imports
- `@core/*` → `../core/*` — shared domain abstractions (webpack alias + tsconfig paths)

### `app/src/app/api/v1/missions/route.ts` — POST handler
**`POST /api/v1/missions`**
- Accepts `multipart/form-data` (browser) or `application/json` (CLI)
- Validates fields via Zod: `slug` (`^[a-z0-9-]+$`), `objective` (required), `target?`, `loadout?`
- Rejects `.pdf` files with 400 (Phase 1 limitation)
- Calls `serverCompileBrief(payload)` → `ResearchPlan`
- Calls `evalPlanWithConfig(plan)` → `PlanEvalResult`
- On gate pass: returns `200 { ok: true, slug, plan, score, dimensions }`
- On gate fail: returns `400 { ok: false, error, violations }`
- On compile error: returns `422 { ok: false, error }`
- Imports from `@core/compile-brief`, `@core/eval`, `@core/types`

### `app/src/app/api/v1/missions/[id]/telemetry/route.ts` — GET handler (stub)
**`GET /api/v1/missions/:id/telemetry`**
- Phase 2 stub — SSE stream emitting a single `{ type: "complete" }` event immediately
- Will be replaced with real mission status polling in Phase 2

### `app/src/app/ingest/IngestForm.tsx` — Client form
- Fields: slug (text), objective (textarea), target (text), loadout (select), file upload (drag-drop)
- Client-side validation: slug regex, objective min 25 chars
- Posts `FormData` to `POST /api/v1/missions`
- On success: stores `ApiIngestSuccess` in `sessionStorage["veritas_result"]`, navigates to `/missions/result?slug=<slug>`
- On 400 gate failure: renders `ViolationBadge` per violation inline

### `app/src/app/missions/result/ResultView.tsx` — Result view
- Reads plan from `sessionStorage["veritas_result"]` on mount
- Renders: dimension table (✓/✗/⚠ per dimension), plan metadata grid, CLI handoff command with copy button, download JSON button, raw JSON accordion

---

## harness/veritas-research/ — Template Harness (8 Planes, No Domain Logic)

The generic infrastructure. No concrete loadouts, no domain tools.

```
src/
├── llm/          ← LLMBackbone.complete() — provider abstraction + fallback chain
├── config/       ← typed config, env-var key resolution, redact()
├── agent/        ← ReAct loop (propose → check → execute → observe → repeat)
│   └── specialists.ts  ← LoadoutRegistry (no concrete loadouts)
├── safety/
│   ├── scope.ts        ← checkScope() — pure predicate, deny off-scope/loopback/private
│   ├── approval.ts     ← requestApproval() — risk-tier gating, fail-safe deny unattended
│   ├── human-release.ts  ← requireHumanRelease() — stop before consequential actions
│   └── index.ts        ← composed check(): checkScope → requestApproval
├── tools/        ← typed ToolRegistry { name, description, inputSchema (zod), riskTier, run() }
├── parse/        ← robust JSON extraction (strip fences → direct parse → balanced span scan)
├── mission/      ← Mission object: append-only transcript + findings
├── evidence/     ← provenance gate + adversarial refuter
├── orchestration/ ← ADV-tier decomposition orchestrator (honest decomposition only)
└── mcp-server.ts  ← safe scope-gated MCP subset
```

**Tests:** 178 tests, no domain tests

---

## harness/veritas-example/ — Research Domain Harness

The concrete domain harness — adds ingest, RSI, bench, loadouts on top of the template.

```
src/
├── agent/loadouts.ts    ← concrete loadouts: codebase-audit, research, web-recon
├── ingest/              ← sanitize → parse → fit (LLM) → validate (Zod) → dogma gate → research-plan.json
│   ├── ingest.ts        ← runIngest({ inputPath, slug, dryRun }) — main entry
│   ├── parse-intent.ts  ← parse markdown brief into structured intent
│   ├── fit-intent.ts    ← fitIntent(intent) — LLM call to produce ResearchPlan JSON
│   ├── sanitize.ts      ← sanitizeInput(text) — strip control chars, truncate
│   └── validate.ts      ← validatePlan(obj) — Zod parse + dogma gate
├── resources/
│   ├── research-plan.ts  ← loadResearchPlan(path) — load + validate from disk
│   ├── plan-eval.ts      ← evalPlanWithConfig(), renderEvalReport() — domain-side eval
│   ├── source-digest.ts  ← digestSources() — fetch + summarize plan sources via LLM
│   └── lessons.ts        ← record/retrieve structured mission lessons
├── rsi/                  ← recursive self-improvement loop (dry-run only; human-gated apply)
├── memory/               ← context-window.ts — ephemeral windowing
└── config/dogma.ts       ← research-plan schema validation config (domain extension)
scripts/
├── verify-claims.mjs     ← re-derive every headline number from committed artifacts
├── verify-finding.mjs    ← run adversarial refuter against a finding
├── bench.mjs             ← committed-oracle benchmark suites
├── lessons.mjs           ← record/retrieve lessons CLI
└── analyze.mjs           ← generate research-analysis-{datetime}.md
```

**Tests:** 243 tests across 28 files

---

## CLI Workflow (STEP 1 + STEP 2 via terminal)

```bash
cd harness/veritas-example

# STEP 1a: Write brief to ingest/NEW.md, then ingest it
bun run ingest --input ingest/NEW.md --slug my-mission
# → writes missions/my-mission/research-plan.json

# STEP 1b: Evaluate the plan (dogma gate only, no execution)
bun run dev eval --plan missions/my-mission/research-plan.json

# STEP 1c: Digest sources referenced in the plan
bun run dev digest --plan missions/my-mission/research-plan.json

# STEP 2: Run the mission
bun run dev start --plan missions/my-mission/research-plan.json

# Verify claims after mission
bun run verify-claims
```

---

## Web App Workflow (STEP 1 via browser)

```
1. User visits /ingest
2. Fills: slug (e.g. "api-security-audit"), objective, target, loadout, optional file
3. POSTs FormData to /api/v1/missions
4. Server: compile-brief (LLM) → dogma gate (8 dimensions)
5a. Gate pass → /missions/result?slug=api-security-audit
    - Shows dimension scores, plan metadata
    - Shows CLI handoff: bun run dev start --plan missions/api-security-audit/research-plan.json
    - (Plan NOT yet written to disk — CLI must run ingest separately in Phase 1)
5b. Gate fail → form shows violations inline
```

---

## Safety Spine (non-negotiable invariants)

| Invariant | Where enforced | Description |
|-----------|---------------|-------------|
| 1. Scope before action | `src/safety/scope.ts` | No side-effecting tool runs outside declared scope |
| 2. Fail-safe deny | `src/safety/approval.ts` | Gated tool with no approver = deny, never fire |
| 3. Provenance before claim | `src/evidence/gate.ts` | No finding without tool observation in log |
| 4. Refute before confirm | `src/evidence/refuter.ts` | Second model instance must fail to disprove |
| 5. Human before consequence | `src/safety/human-release.ts` | Terminal actions stop and await human release |
| 6. Reproduce before report | `scripts/verify-claims.mjs` | Every headline number re-derives from artifacts |
| 7. Honest decomposition | `src/orchestration/` | Workers receive truthful task descriptions |
| 8. Compose, don't fork | Loadout API | New domains = new Loadout, never a loop copy |

---

## Config / Provider

Each harness has `src/config/default.json` + optional gitignored `local.json`. Default provider: Anthropic (Claude API).

```bash
# Override for one run
HARNESS_MODEL=claude-opus-4-8 bun run dev start "objective" --target .
HARNESS_PROVIDER=ollama HARNESS_MODEL=qwen3-coder:latest bun run dev start ...

# Persistent override
bun run veritas-config  # interactive wizard
```

Web app uses `ANTHROPIC_API_KEY` + optional `VERITAS_MODEL` env var (defaults to `claude-sonnet-4-6`).

---

## Key Interfaces

### ResearchPlan (core/schema.ts)
```typescript
{
  version: "1";
  metadata: { slug, ingestedAt, ingestVersion, model };
  objective: string;           // min 15 chars, specific mission goal
  loadout: "codebase-audit" | "research" | "web-recon";
  target: string;              // filesystem path or hostname
  scope: { hosts: string[]; paths: string[] };
  specialists: Array<{ role, focus }>;  // min 2 entries, focus min 15 chars
  phases: Array<{ id, description }>;  // min 2 entries
  sources: Array<{ url, type, description }>;
  lessons: string[];
  successCriteria: string[];   // each entry must contain measurable language
}
```

### MissionPayload (core/types.ts)
```typescript
{
  slug: string;
  objective: string;
  target?: string;
  loadout?: "codebase-audit" | "research" | "web-recon";
  fileContent?: string;  // text file content from upload
  fileName?: string;
}
```

### ApiIngestResult (core/types.ts)
```typescript
{ ok: true;  slug; plan: ResearchPlan; score: number; dimensions: DimensionResult[] }
| { ok: false; error: string; violations?: DimensionResult[] }
```

---

## Phase Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| Phase 1 | STEP 1 in browser: form → compile → gate → result | **Complete** |
| Phase 2 | Mission status stream: `/api/v1/missions/:id/telemetry` SSE | Stub only |
| Phase 3 | Trigger STEP 2 from App: start mission from browser | Not started |
