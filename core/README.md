# core/ — the shared contract package

`core/` is the **repo-level source of truth for the verified & validated data model**: the
`ResearchPlan` schema, the Dogma Gate, the plan evaluator, and the ingest compiler contract. It is
pure, dependency-light TypeScript with **no external, harness-specific, or runtime-specific imports**,
so it can be consumed from any runtime (Node, Bun, a future UI client).

| File | Exports | Role |
|------|---------|------|
| `schema.ts` | `researchPlanSchema`, `ResearchPlan` | the plan contract (Zod) |
| `dogma.ts` | `DEFAULT_DOGMA`, `buildDogma()` | the 8 Dogma Gate dimensions |
| `eval.ts` | `evalPlan()`, `evalPlanWithConfig()` | run the gate, return pass/fail + score |
| `types.ts` | `MissionPayload`, `ApiIngestResult` | ingest request/response envelope |
| `extract-json.ts` | `parseLastObject()` | robust JSON extraction from model output |
| `ingest-contract.ts` | `INGEST_SYSTEM_PROMPT`, `compileBrief(payload, llm)` | runtime-agnostic intent→plan compiler (inject the LLM caller) |
| `plan-io.ts` | `writePlan()`, `loadPlan()` | persist/read a `research-plan.json` |

> The former `compile-brief.ts` (an `@anthropic-ai/sdk` adapter) was removed with the `app/`
> teardown (v0.3 Feature 3). The runtime-agnostic `compileBrief` in `ingest-contract.ts` remains and
> takes an injected LLM caller, so `core/` keeps **zero external dependencies**. The harness API
> (`harness/veritas-example`, `POST /v1/ingest`) is now the ingest entry point.

## Consumers and the vendoring rule

- The **harness API** and any **future UI client** reach ingest/plan logic through the HTTP API; the
  contract in `core/` is the shared source of truth behind it.
- **`harness/veritas-example/`** carries a **vendored copy** of the same contract
  (`src/ingest/schema.ts`, `src/config/dogma.ts`, `src/resources/plan-eval.ts`). This is deliberate:
  a harness must build and run as a self-contained Docker image that does **not** depend on repo-root
  siblings. The harness cannot `import` `../../core/*` at runtime without breaking that isolation.

Vendoring's only risk is silent drift. That risk is closed by an **enforceable drift-guard test**,
not a manual "remember to copy" policy:

```
harness/veritas-example/src/ingest/contract-drift.test.ts
```

It compares the two copies as text and fails CI the moment they diverge on anything that changes
gate behaviour (dimension id + required flags, schema top-level fields) or drops a security invariant
(the "UNTRUSTED DATA" / JSON-only clauses in the ingest compiler). See `docs/veritas-v0.2.md` C-1/C-2.

## Changing the contract

1. Edit the `core/` file (the source of truth).
2. Mirror the change into the harness vendored copy.
3. Run `cd harness/veritas-example && bun test src/ingest/contract-drift.test.ts` — it must stay green.

A future workstream (`agents/plans/PHASE2.md` B4) promotes `core/` into the harness template so newly
created harnesses reference it the same way they reference `base-scripts/`, removing the per-harness copy.
