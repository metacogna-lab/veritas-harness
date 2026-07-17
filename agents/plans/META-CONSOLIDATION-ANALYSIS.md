# Meta-Harness Consolidation — Architecture Analysis (Phase 1)

Date: 2026-07-17
Branch: `feat/meta-consolidation-observability`

## Question 1 — Is any harness *generation* performed from `harness/` subfolders?

**Answer: No.** Harness generation (scaffold → manifest → register → install → test) is
performed **exclusively** in `meta/`:

| Generation concern | Owner | Notes |
|---|---|---|
| Ordered create pipeline | `meta/create-harness.ts` | `createHarness()` (7 stages) |
| Registry writes | `meta/registry.ts` | `writeRegistry`, `addHarness`, `nextIndex` |
| Scaffold (token substitution) | `meta/scaffold.ts` | `copyDirWithTokens`, capability packs |
| Manifest | `meta/manifest.ts` | `writeManifest` |
| Spec contract + loadout codegen | `meta/harness-spec.ts` | `deriveHarnessSpec`, `renderLoadoutsModule` |
| Template seed | `meta/templates/harness-template/` | the 8-plane spine new harnesses start from |

A tree-wide scan for `writeRegistry | addHarness | copyDirWithTokens | writeManifest |
createHarness | nextIndex` inside `harness/*/src` returns **nothing**. No harness scaffolds,
registers, or installs another harness. Invariant #4 (creation only through the pipeline) holds.

### The one exception — a *generation-adjacent* bridge, not a generator

`harness/veritas-example/src/ingest/to-harness-spec.ts` reaches **up** into meta:

```ts
import { deriveHarnessSpec, ... } from "../../../../meta/harness-spec.ts";
```

It does **not** scaffold or register — it only maps a domain `ResearchPlan` into meta's
`IngestedIntent` and calls `deriveHarnessSpec` to produce a `HarnessSpec` JSON (the contract
`create-harness --from-spec` consumes). So the confirmation stands: generation is meta-only.
But this bridge is *generation-involved code living in a harness*, and it is the subject of
Phase 2.

Key facts driving the Phase 2 decision:
- **No production caller.** `researchPlanToHarnessSpec` / `planToIngestedIntent` are referenced
  only by their own co-located test — never by `ingest.ts`, the CLI, or the RSI loop.
- **Wrong-direction import.** A harness subfolder importing `../../../../meta/` inverts the
  intended dependency arrow (meta owns harnesses, not the reverse) and is fragile to layout.
- **The generic half is already at root.** `deriveHarnessSpec` + `IngestedIntent` +
  `renderLoadoutsModule` already live in `meta/harness-spec.ts`. Only the thin plan→intent
  lift sits in the harness.

## Architecture map (as-is)

```
root
├── meta/                     harness GENERATION (create pipeline, registry, spec, template)
│   └── templates/harness-template/   scaffold seed (older, pre-spine-extraction copy)
├── core/spine/               the ONE canonical 8-plane spine (invariant #8); @spine/* alias
│   ├── config safety evidence llm mission orchestration parse tools bench control
├── base-scripts/             shared doctor/config scripts referenced by every harness
└── harness/
    ├── veritas-research (#1)  reference harness, migrated onto core/spine
    ├── veritas-example  (#2)  research domain harness, migrated onto core/spine
    └── solo-hackathon   (#3)  generated via create-harness --from-spec (HARNESS_SPEC.json)
```

Confirmed by `meta/spine-drift.test.ts`: `veritas-research` and `veritas-example` carry **no**
local spine copy — they import `@spine/*`. `meta/templates/harness-template` still carries an
independently-diverged spine (a real API port, tracked as a follow-up — out of scope here).

## Phase 2 decision

Move the plan→spec bridge to `meta/`, typed against a **structural** plan input so meta stays
free of the domain mission schema (preserving the documented decoupling). Delete the harness
copy (no production caller). Net effect: the entire intent→spec generation path lives at root;
`harness/` holds zero generation code and zero upward `../../../../meta` imports.

## Phase 3 decision (observability ↔ RSI)

Confirmed against `research/meta-analyses/2026-07-11-harness-architecture-rsi.md`: the papers
converge on *queryable external history + weakness mining over execution traces* as the RSI
substrate. Veritas already implements the chain
(`telemetry → experience-store → rsi/weakness-mining → failure-clusters.md → proposer`). Phase 3
documents its configuration and the linkage in `OBSERVABILITY.md`, and records the coverage plan.
