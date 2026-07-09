# Plan 07 — Ingest Workflow

Goal: compile human research intent (`NEW.md`) into a validated `research-plan.json` consumable by the Veritas research harness.

Dependencies: BASIC+INT harness spine under `harness/veritas-research/` (loadouts, control plane, lessons store).

## What this adds

An `ingest/` meta-harness workflow upstream of mission execution:

1. Parse and sanitize `NEW.md` (untrusted input)
2. LLM-primary fit to `TEMP.md` template schema
3. Pull resources from `harness/veritas-research/src/resources/` and `resources/lessons.json`
4. Zod-validate output
5. Write `missions/<slug>/research-plan.json`
6. Control plane consumes plan via `veritas start --plan`

## Directory layout

```
ingest/
  NEW.md              operator slot (gitignored)
  TEMP.md             template + schema documentation
  examples/           committed example briefs
  src/                sanitize, parse, catalog, fit, validate, ingest
  scripts/ingest.mjs  CLI entry

harness/veritas-research/
  missions/<slug>/research-plan.json
  src/resources/research-plan.ts
  src/agent/loadouts.ts  (+ research loadout)
```

## Tasks

### 7.1 Schema and sanitization
- [x] `ingest/src/schema.ts` — Zod `ResearchPlan` schema (single source of truth)
- [x] `ingest/src/sanitize.ts` — zero-width strip, injection pattern block
- [x] `ingest/src/parse-intent.ts` — NEW.md frontmatter + ## sections
- [x] Unit tests for each module

### 7.2 Resources catalog
- [x] `ingest/src/resources-catalog.ts` — lessons store + resource modules + NEW.md sources
- [x] Extensible for future `src/resources/*` modules

### 7.3 LLM fitter + validation gate
- [x] `ingest/src/fit-intent.ts` — LLM-primary with retry on Zod failure (max 2)
- [x] `ingest/src/validate.ts` — `parseLastObject` + Zod
- [x] `ingest/scripts/ingest.mjs` — CLI

### 7.4 Harness consumption
- [x] `research` loadout in `loadouts.ts`
- [x] `src/resources/research-plan.ts` — load + `planToStartOptions`
- [x] `control/plane.ts` — `StartOptions.plan`
- [x] `cli.ts` — `--plan` and `ingest` verb

### 7.5 Consumability
- [x] `skills/harness-ingest/SKILL.md`
- [x] `.claude/commands/ingest.md`
- [x] `agents/evals/ingest-workflow.md`

## Safety (from 06-risk-register defensive checklist)

- [x] Ingested content never at system-prompt trust level
- [x] Zero-width/homoglyph stripping before processing
- [x] Injection pattern block on NEW.md
- [x] Validated JSON only reaches control plane

## Definition of done

- [x] `bun test` green in `ingest/` and `harness/veritas-research/`
- [x] Mock-LLM integration test produces valid plan from example NEW.md
- [x] Golden `missions/example-slug/research-plan.json` loads via `loadResearchPlan`
- [x] `veritas start --plan` uses plan objective/scope and records plan note
- [x] Research loadout registered as third loadout (compose, don't fork)

## Roadmap (not v1)

- Automatic orchestrator execution of `phases[]`
- Lessons feedback into ingest planning (see lessons.ts ROADMAP)
- MCP exposure of ingest
- verify-claims metrics for ingest success rate
