# UI_APP — Phase 1: API Control Plane + Web Dashboard + CLI API Client

**Authored:** 2026-07-12  
**Based on:** System Directive (Veritas Phase 1 UI & API Implementation)  
**Supersedes:** UNIFY_CLI.md (already implemented — see §0)

---

## 0. Current State Snapshot (what already exists)

Before touching anything, understand what the UNIFY_CLI plan already shipped:

| File | Status |
|------|--------|
| `harness/veritas-example/src/ingest/cli.ts` | **Complete** — dual-mode CLI (interactive + headless + dir batch + JSON output + Dogma Gate inline) |
| `harness/veritas-example/src/ingest/dir-scanner.ts` | **Complete** — directory walker + symlink staging |
| `harness/veritas-example/src/ingest/interview.ts` | **Complete** — readline interview with prefill |
| `harness/veritas-example/src/ingest/ingest.ts` | **Complete** — `syntheticContent` option present |
| `harness/veritas-example/src/config/dogma.ts` | **Complete** — 8 dimensions, pure predicate functions |
| `harness/veritas-example/src/resources/plan-eval.ts` | **Complete** — `evalPlan()`, `evalPlanWithConfig()`, `renderEvalReport()` |
| `app/package.json` | **Placeholder** — empty shell, no framework |
| `app/README.md` | **Placeholder** — description only |

The UNIFY_CLI directive's ingest improvements are fully built. **Do not re-implement them.** This plan extends from that baseline.

---

## 1. Architecture Boundaries (Enforced Before Code)

```
┌─────────────────────────────────────────────────────────────────────┐
│  packages/core/                                                     │
│  Pure TypeScript — zero FS/network deps                             │
│  ├─ ResearchPlan schema (Zod) ─ re-export from harness/src/         │
│  ├─ evaluateDogmaGate(plan) → ValidationResult  (pure)              │
│  └─ DOES NOT contain compileBrief — LLM calls stay server-side      │
└──────────────────────┬──────────────────────────────────────────────┘
                       │ imported by
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼──────────┐       ┌──────────▼──────────────────────────────┐
│  Next.js App     │       │  Next.js API (app/api/)                 │
│  (Browser)       │       │  POST /api/v1/missions                  │
│  Vercel AI SDK   │ HTTP  │   → parse multipart payload             │
│  useChat hook    │ ────► │   → call harness LLMBackbone (server)   │
│  generateObject  │       │   → compileBrief (fitIntent wrapper)    │
│  submit tool     │       │   → evaluateDogmaGate                   │
└──────────────────┘       │   → HTTP 200 (mission_id) or 400 (gate) │
                           │  GET /api/v1/missions/:id/telemetry (SSE)│
                           │  POST /api/v1/missions/:id/refute        │
                           └──────────────────────────────────────────┘
                                          │ HTTP
                           ┌──────────────▼──────────────────────────┐
                           │  Veritas CLI (cli/ingest.ts)            │
                           │  Local file collection + FormData bundle │
                           │  → POST to API endpoint                  │
                           │  → parse JSON response                   │
                           │  [--local fallback: existing cli.ts]     │
                           └──────────────────────────────────────────┘
```

**Key constraint that differs from the directive:**  
`compileBrief(payload) → ResearchPlan` **cannot be pure** — `fitIntent()` in the current harness calls the LLM and reads `TEMP.md` from disk. Therefore `@veritas/core` only houses the Zod schema and the Dogma Gate evaluator (both already pure). The API route handles all LLM calls server-side.

---

## 2. Breaking Changes — Decisions Required Before Implementation

The following changes affect existing code and require explicit sign-off.

### ⚠️ B-1: Workspace restructure (medium risk)

The directive introduces `packages/core/` as a new monorepo member. This requires:

- Root `package.json` adding `"workspaces": ["packages/*", "app", "harness/*"]`
- A new `packages/core/package.json` with `"name": "@veritas/core"`
- `bun install` at the root must now resolve cross-workspace dependencies

**Impact:** All existing `bun install` / `bun test` invocations in `harness/veritas-example/` and `harness/veritas-research/` continue to work (they are self-contained). Root-level `bun install` changes behaviour.

**Decision required:** Confirm workspace setup is acceptable, or prefer keeping `packages/core/` as a local import alias inside `app/` only (simpler but not a real monorepo package).

### ⚠️ B-2: CLI local execution removal (high risk, potential regression)

The directive states: "The CLI must no longer execute locally. The CLI is now an API Client."

**Current behaviour:** `bun run ingest` runs fully offline. No server required. All 178 tests pass without a network connection.

**Proposed change:** CLI POSTs to a Next.js API. If the server is not running, `bun run ingest` fails with a network error.

**Risk:** Breaks all existing tests for `src/ingest/`. Breaks offline/Docker/CI usage where the Next.js server is not available. The STATIC_DEPLOYMENT.md plan explicitly assumes a headless CLI that works without any external server.

**Recommended resolution:** Add an `--api-url <url>` flag to the existing CLI. Default behaviour remains local execution (no regression). When `--api-url` is provided, the CLI switches to API-client mode. Mark local mode as the primary path; API-client mode as the cloud-deployment path.

**Decision required:** Accept the graduated `--api-url` approach, or enforce API-only and explicitly retire offline mode?

### ⚠️ B-3: `@veritas/core` import path changes (low risk, but must be tracked)

If `packages/core/` re-exports `researchPlanSchema`, `evaluateDogmaGate`, and types, then:

- Harness files currently import: `from "../ingest/schema.ts"`, `from "../config/dogma.ts"`, `from "../resources/plan-eval.ts"`
- After extraction, they could import from `@veritas/core` instead

**Recommendation:** Do **not** change harness import paths in Phase 1. Have `packages/core/` copy (not re-export from) the schema and dogma files. This keeps the harness self-contained and avoids cascading test breakage. Sync strategy (harness → core) is a Phase 2 concern.

**Decision required:** Confirm copy-not-refactor approach for Phase 1.

### ⚠️ B-4: Next.js / Vercel runtime vs Bun

The harness is built for Bun. The `app/` directory (Vercel deployment) runs on Node.js 18+ (Vercel serverless). The LLM backbone and other harness modules use `tsx` and Bun-specific test APIs.

**For Phase 1 API routes:** Import only `@veritas/core` (pure TS, no Bun deps) from Vercel functions. The `LLMBackbone` and `fitIntent` are called via the Anthropic SDK (`@anthropic-ai/sdk`), which is Node.js-compatible.

**Do not import from `harness/veritas-example/src/` directly in `app/api/` routes.** Use `@veritas/core` for schemas, and reimplement a thin `serverCompileBrief()` in `app/lib/` using the Anthropic SDK directly.

---

## 3. Implementation Sequence

### Step 1: `packages/core/` — Pure Schema + Dogma Gate Package

**New directory:** `packages/core/`

**Files to create:**

```
packages/core/
  package.json           name: "@veritas/core", exports: { "./schema", "./dogma", "./eval" }
  tsconfig.json          target: ES2020, module: NodeNext, strict: true
  src/
    schema.ts            COPY of harness/veritas-example/src/ingest/schema.ts (no import changes)
    dogma.ts             COPY of harness/veritas-example/src/config/dogma.ts
    eval.ts              COPY of harness/veritas-example/src/resources/plan-eval.ts
    types.ts             MissionPayload, ValidationResult, ApiIngestResponse types
    index.ts             re-exports all
```

**`packages/core/src/types.ts`** — new API-contract types:

```typescript
import type { ResearchPlan } from "./schema.ts";

export interface MissionPayload {
  slug: string;
  objective: string;
  target?: string;
  loadout?: string;
  fileContent?: string;       // UTF-8 text of uploaded MD/PDF
  fileName?: string;
}

export interface ApiIngestResponse {
  ok: true;
  missionId: string;
  slug: string;
  plan: ResearchPlan;
}

export interface ApiIngestError {
  ok: false;
  error: string;
  violations?: Array<{ id: string; reason: string }>;
}

export type ApiIngestResult = ApiIngestResponse | ApiIngestError;

export interface TelemetryEvent {
  type: "log" | "finding" | "error" | "complete";
  ts: string;
  payload: unknown;
}
```

**`packages/core/package.json`:**

```json
{
  "name": "@veritas/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema.ts",
    "./dogma": "./src/dogma.ts",
    "./eval": "./src/eval.ts",
    "./types": "./src/types.ts"
  }
}
```

**Harness files:** No changes. The harness continues importing from its own `src/` paths.

**Tests:** Copy the corresponding test files from the harness into `packages/core/src/` (schema, dogma, eval tests) and verify they pass with `bun test` in `packages/core/`.

---

### Step 2: Next.js App Scaffold

**Replace** the placeholder `app/` with a full Next.js 15 App Router project.

```bash
cd app
bunx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias
```

Then install additional dependencies:

```bash
bun add ai @ai-sdk/anthropic zod
bun add -d @types/node
```

**Root `package.json`** — add workspace configuration:

```json
{
  "workspaces": ["packages/*", "app", "harness/*"]
}
```

**`app/next.config.ts`** — ensure the `@veritas/core` workspace package resolves:

```typescript
const nextConfig = {
  experimental: {
    externalDir: true,      // allow imports from outside app/
  },
};
export default nextConfig;
```

**`app/tsconfig.json`** — add path alias:

```json
{
  "compilerOptions": {
    "paths": {
      "@veritas/core": ["../packages/core/src/index.ts"],
      "@veritas/core/*": ["../packages/core/src/*"]
    }
  }
}
```

---

### Step 3: Next.js API Routes

All routes live under `app/src/app/api/v1/`.

#### `POST /api/v1/missions` — Ingest + Dogma Gate

**File:** `app/src/app/api/v1/missions/route.ts`

```
Accept:   multipart/form-data
Fields:   slug (string), objective (string), target? (string),
          loadout? (string), file? (File — .md or .pdf text)

Logic:
  1. Parse FormData — validate with Zod (slug required, objective required)
  2. If file uploaded: read as UTF-8 text (use file.text())
  3. Call serverCompileBrief(payload) → ResearchPlan
     - serverCompileBrief lives in app/src/lib/compile-brief.ts
     - Uses @anthropic-ai/sdk directly (Node.js compatible)
     - Does NOT import from harness/
  4. Call evaluateDogmaGate(plan) from @veritas/core
  5. If gate fails → HTTP 400, { ok: false, error, violations }
  6. If gate passes → generate missionId (uuid), store plan in-memory or KV
  7. HTTP 200 → { ok: true, missionId, slug, plan }

Error codes:
  400 — Zod validation failure (missing fields)
  400 — Dogma Gate failure (with violations array)
  422 — compileBrief LLM failure
  500 — unexpected error
```

**File:** `app/src/lib/compile-brief.ts`

```typescript
// Server-side brief compiler using Anthropic SDK directly.
// Does NOT import from harness/ — uses @veritas/core for schema + eval only.
import Anthropic from "@anthropic-ai/sdk";
import { researchPlanSchema } from "@veritas/core/schema";
import { extractJson } from "./extract-json.ts";  // port of harness/src/parse/json.ts
import type { MissionPayload } from "@veritas/core/types";
import type { ResearchPlan } from "@veritas/core/schema";

const client = new Anthropic();  // reads ANTHROPIC_API_KEY from env

export async function serverCompileBrief(payload: MissionPayload): Promise<ResearchPlan> {
  // Build system + user prompt (mirrors harness/src/ingest/fit-intent.ts logic)
  // Call client.messages.create(...)
  // Parse JSON from response using extractJson()
  // Validate with researchPlanSchema.parse()
  // Retry up to 2 times on validation failure
  // Return ResearchPlan
}
```

#### `GET /api/v1/missions/:id/telemetry` — Server-Sent Events

**File:** `app/src/app/api/v1/missions/[id]/telemetry/route.ts`

Phase 1 stub — returns SSE stream that emits a `complete` event immediately. Full telemetry (reading from active harness sandbox) is Phase 2.

```typescript
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const event: TelemetryEvent = { type: "complete", ts: new Date().toISOString(), payload: { missionId: params.id } };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

#### `POST /api/v1/missions/:id/refute` — Adversarial Refuter Trigger

**File:** `app/src/app/api/v1/missions/[id]/refute/route.ts`

Phase 1 stub — accepts the request, returns `{ ok: true, status: "queued" }`. Full refuter integration is Phase 3.

---

### Step 4: Next.js Web Dashboard — Conversational Ingest

**File:** `app/src/app/ingest/page.tsx`

**Approach:** Vercel AI SDK `useChat` hook. The LLM acts as a conversational intake agent that collects mission parameters, then calls a tool to submit them to the API.

```typescript
// Tool schema the LLM can call when it has enough info:
const submitToDogmaGateTool = {
  description: "Submit collected mission parameters to the Dogma Gate for validation",
  parameters: z.object({
    slug: z.string(),
    objective: z.string().min(25),
    target: z.string().optional(),
    loadout: z.string().optional(),
  }),
};
```

**Flow:**
1. User opens `/ingest` — chat UI renders
2. System message instructs the LLM to collect `slug`, `objective`, `target`, `loadout` conversationally
3. User can also drag/drop a `.md` or `.pdf` file (uploaded via browser `<input type="file">`)
4. When LLM has all required fields, it calls `submit_to_dogma_gate` tool
5. Client intercepts tool call → `POST /api/v1/missions` with FormData
6. On HTTP 200: navigate to `/missions/:id` dashboard
7. On HTTP 400 (gate violation): feed violation reasons back into AI SDK context → LLM explains and asks user to correct

**File:** `app/src/app/api/chat/route.ts`

Standard Vercel AI SDK streaming route using `@ai-sdk/anthropic`:

```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { streamText, tool } from "ai";
import { z } from "zod";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: INGEST_SYSTEM_PROMPT,
    messages,
    tools: {
      submit_to_dogma_gate: tool({
        description: "Submit collected mission parameters to the Veritas Dogma Gate",
        parameters: z.object({
          slug: z.string().describe("URL-safe mission identifier"),
          objective: z.string().min(25).describe("Specific, falsifiable research objective"),
          target: z.string().optional().describe("Scope boundary — path, host, or URL prefix"),
          loadout: z.enum(["research", "codebase-audit", "web-recon"]).optional(),
        }),
      }),
    },
    maxSteps: 5,
  });
  return result.toDataStreamResponse();
}
```

**File:** `app/src/app/missions/[id]/page.tsx`

Mission status dashboard — Phase 1 shows plan JSON + Dogma Gate scores. Phase 2 adds live telemetry via SSE.

---

### Step 5: CLI API-Client Mode (Graduated Approach)

**File:** `harness/veritas-example/src/ingest/cli.ts` — **EDIT** (additive only)

Add `--api-url` flag. When present, all local execution is bypassed and the CLI becomes an HTTP client.

```typescript
// Additional flag in parseArgs:
"api-url": { type: "string" },
```

**New routing logic in `main()`:**

```typescript
if (values["api-url"]) {
  await runApiClientMode(values["api-url"], values, jsonMode);
  return;
}
// ... existing local execution logic unchanged below ...
```

**New function `runApiClientMode()`:**

```typescript
async function runApiClientMode(apiUrl: string, values: ParsedFlags, jsonMode: boolean): Promise<void> {
  // 1. Collect params (same as headless mode)
  // 2. Build FormData: { slug, objective, target, loadout }
  // 3. If values.dir: walk dir, read files, append each as FormData file entry
  // 4. POST to ${apiUrl}/api/v1/missions
  // 5. Parse JSON response
  // 6. On ok: print planPath or JSON; exit 0
  // 7. On !ok: print violations; exit 1
}
```

**Important:** Local mode (no `--api-url`) is unchanged. Existing tests continue to pass. The `--api-url` flag is the only addition.

---

### Step 6: Environment Variables

**`app/.env.local` (gitignored):**

```
ANTHROPIC_API_KEY=sk-ant-...
```

**`app/.env.example` (committed):**

```
ANTHROPIC_API_KEY=
```

---

## 4. API Contract (v1)

```
POST   /api/v1/missions
       Content-Type: multipart/form-data
       Body: slug, objective, target?, loadout?, file? (.md/.pdf UTF-8)
       200: { ok: true, missionId: string, slug: string, plan: ResearchPlan }
       400: { ok: false, error: string, violations?: [{id, reason}] }
       422: { ok: false, error: "compileBrief failed: <reason>" }
       500: { ok: false, error: "internal error" }

GET    /api/v1/missions/:id/telemetry
       Accept: text/event-stream
       Emits: TelemetryEvent NDJSON per SSE data frame
       [Phase 1: stub — emits complete immediately]

POST   /api/v1/missions/:id/refute
       200: { ok: true, status: "queued" }
       [Phase 1: stub]
```

---

## 5. File Manifest

### New files

| Path | Description |
|------|-------------|
| `packages/core/package.json` | `@veritas/core` package manifest |
| `packages/core/tsconfig.json` | TypeScript config |
| `packages/core/src/schema.ts` | Copy of harness schema (no harness imports) |
| `packages/core/src/dogma.ts` | Copy of harness dogma dimensions |
| `packages/core/src/eval.ts` | Copy of harness plan-eval |
| `packages/core/src/types.ts` | API contract types (MissionPayload, etc.) |
| `packages/core/src/index.ts` | Barrel re-export |
| `app/src/app/api/v1/missions/route.ts` | POST ingest endpoint |
| `app/src/app/api/v1/missions/[id]/telemetry/route.ts` | GET SSE stub |
| `app/src/app/api/v1/missions/[id]/refute/route.ts` | POST refute stub |
| `app/src/app/api/chat/route.ts` | Vercel AI SDK streaming chat |
| `app/src/app/ingest/page.tsx` | Conversational ingest UI |
| `app/src/app/missions/[id]/page.tsx` | Mission status view |
| `app/src/lib/compile-brief.ts` | Server-side brief compiler (Anthropic SDK) |
| `app/src/lib/extract-json.ts` | Port of harness JSON extraction (pure) |
| `app/.env.example` | Required env vars |

### Modified files

| Path | Change | Risk |
|------|--------|------|
| `package.json` (root) | Add `"workspaces"` | Low — additive |
| `app/package.json` | Scaffold Next.js (replaces placeholder) | Low — placeholder only |
| `harness/veritas-example/src/ingest/cli.ts` | Add `--api-url` flag + `runApiClientMode()` | Low — additive, no existing logic changes |

### Files NOT changed

| Path | Reason |
|------|--------|
| `harness/veritas-example/src/ingest/ingest.ts` | Already has `syntheticContent` |
| `harness/veritas-example/src/config/dogma.ts` | Not refactored out — copied to core |
| `harness/veritas-example/src/resources/plan-eval.ts` | Not refactored out — copied to core |
| All `*.test.ts` files in harness | Must remain green; no changes to harness import paths |

---

## 6. Verification Gates

```bash
# 1. Core package builds and tests pass
cd packages/core && bun test
# → all schema/dogma/eval tests green

# 2. Existing harness tests still green
cd harness/veritas-example && bun test
# → 178+ tests, no regressions

# 3. CLI local mode unchanged
cd harness/veritas-example && bun run ingest --help
bun run ingest -s test -o "Verify scope gate blocks loopback by checking src/safety/scope.ts line by line" -t ./src --json

# 4. Next.js app builds
cd app && bun run build
# → no TypeScript errors

# 5. API reachable locally
cd app && bun run dev &
curl -X POST http://localhost:3000/api/v1/missions \
  -F "slug=test" \
  -F "objective=Verify scope gate blocks loopback by checking src/safety/scope.ts line by line" \
  -F "target=./src"
# → 200 or 400 (Dogma Gate result)

# 6. CLI API-client mode
cd harness/veritas-example
bun run ingest -s test -o "Verify scope gate blocks loopback by checking src/safety/scope.ts line by line" \
  -t ./src --api-url http://localhost:3000 --json
# → delegates to API; same result as #5

# 7. Web dashboard reachable
open http://localhost:3000/ingest
# → conversational UI renders; can submit mission; Dogma Gate feedback visible
```

---

## 7. Open Decisions (Block Implementation Until Resolved)

The following require explicit answers before writing any code.

### D-1: CLI offline fallback (⚠️ B-2)

> Should `bun run ingest` keep local execution as the default, with `--api-url` enabling cloud routing?
> OR should local execution be removed and all ingest go through the Next.js API?

**Recommendation:** Keep local execution. Add `--api-url` as additive flag. Reason: the STATIC_DEPLOYMENT plan, Docker, and CI all rely on offline CLI; removing it would require re-testing all 178 tests in a server-up context.

### D-2: `packages/core/` vs direct import alias (⚠️ B-1)

> Full bun workspace monorepo with `packages/core/` package, OR a simpler path alias in `app/tsconfig.json` pointing directly at the copied files?

**Recommendation:** Workspace monorepo. It's the right long-term structure and bun workspaces are first-class. The risk is low since it's additive to the root `package.json`.

### D-3: Phase 1 scope of UI

> Is Phase 1 limited to conversational ingest + plan display (what this plan covers), or does it include:
> - Live mission execution triggered from the UI?
> - Real telemetry streaming (requires running harness in a cloud sandbox)?
> - Adversarial refuter UI?

**Recommendation:** Phase 1 = ingest + Dogma Gate feedback only. Telemetry and refuter are Phase 2 (SSE and refute routes are stubs in this plan).

### D-4: Temporary file storage for API uploads

> The directive mentions "Modal Volume" for uploaded files. For Vercel serverless, there is no persistent FS.
>
> Options:
> a. Process uploaded file content in-memory only (text extraction, no FS write) — simplest
> b. Write to Vercel `/tmp` (ephemeral, max 512 MB, lost after request) — acceptable for single-request compile
> c. Use R2/S3 for durable storage — requires additional infra

**Recommendation:** Option (a) for Phase 1. The ingest pipeline accepts `syntheticContent` (already implemented in the harness). For PDF files, extract text in-memory using a lightweight library (`pdf-parse` or built-in `pdf2json`) before passing to `serverCompileBrief`. No FS writes in the API route.

---

## 8. Phase Map

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Ingest CLI (UNIFY_CLI) | **Done** |
| 1 | `@veritas/core` + Next.js API + Web Dashboard + CLI `--api-url` | **This plan** |
| 2 | Live telemetry SSE (harness sandbox integration) | Future |
| 3 | Adversarial refuter UI + `POST /refute` implementation | Future |
| 4 | VS Code extension / Slack bot / CI integration | Future |
