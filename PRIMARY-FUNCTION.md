# Primary Function

> For operator use cases and command reference, see [USE-CASES.md](./USE-CASES.md).

---

## Veritas (the meta-harness)

Veritas is a **harness factory**. Its job is to make it possible to stamp out safe, reproducible, evidence-grounded agent loops for any objective domain — without rewriting the core each time.

The meta-harness owns:

- The **8-plane architecture** (provider → safety → verification → memory → capability → execution → orchestration → control) that every harness inherits as its spine
- The **`create-harness` pipeline** (`bun run create-harness <name>`) — the one sanctioned way to bring a new harness into existence; it scaffolds, registers, and installs capability packs in a single ordered pass
- The **harness registry** (`harnesses.json`) — an ordered, 1-based index of every harness under `harness/`
- The **generic operating skills** under `skills/` — `harness-new`, `harness-init`, `harness-tool-adder`, `harness-refuter`, `harness-eval-runner`, `harness-provider`, `harness-config`, `harness-evolver` — which work against any registered harness, not just one

The meta-harness has no mission loop of its own. It does not run agents. It creates and governs the things that do.

---

## Veritas Research (harness #1)

`harness/veritas-research/` is the **first concrete instantiation** of the Veritas architecture. Its domain is structured research: ingest a brief, scope a corpus, run a ReAct loop against authorised sources, verify findings adversarially, and produce a reproducible report.

It provides:

- A **ReAct agent loop** backed by the full safety spine (scope gate + approval tiers + human-release gate)
- Three **loadouts** covering the research domain's surface:
  - `research` — structured missions driven by an ingested research plan; tools: `read_file`, `list_dir`, `http_get`, `record_finding`
  - `codebase-audit` — read-only audit of a filesystem scope; tools: `read_file`, `list_dir`, `record_finding`
  - `web-recon` — information gathering from authorised hosts; tools: `http_get`, `record_finding`
- The **ingest pipeline** (`bun run ingest`) — compiles a `NEW.md` research brief into a validated `research-plan.json` with scope, sources, and phases
- The **evidence ledger and refuter** — every finding traces to a real observation; a second model instance adversarially challenges it before it is confirmed
- The **RSI outer loop** (`bun run dev rsi`, `/evolve-harness`) — mines failure patterns from mission history, proposes loadout edits, validates against committed benchmarks, and surfaces a human review packet; never self-applies
- The **experience store** (`resources/experience/`) and **lessons delta store** (`resources/lessons.json`) — queryable per-mission history that feeds the RSI pipeline
- Two harness-specific skills: `harness-ingest` and `harness-analysis`

Veritas Research also serves as the **reference implementation**: the template every new harness is scaffolded from, and the living proof that the 8-plane architecture composes correctly.

---

## The overlap

Veritas Research is simultaneously two things:

| Role | What it means |
|------|--------------|
| **A harness** | An agent domain registered in `harnesses.json`, governed by the meta-harness pipeline, using the standard 8-plane spine |
| **The reference implementation** | The canonical build target and the template new harnesses inherit from; if it breaks, the meta-harness is broken |

This dual role creates a tight feedback loop: improvements to Veritas Research's safety plane, evidence model, or RSI machinery are improvements to the template that every future harness inherits. The meta-harness does not impose this — it is a consequence of Veritas Research being harness #1.

The skills are partitioned to make the boundary explicit:

| Location | Scope | Examples |
|----------|-------|---------|
| `skills/` (meta root) | Any harness | `harness-tool-adder`, `harness-refuter`, `harness-evolver` |
| `harness/veritas-research/skills/` | Research domain only | `harness-ingest`, `harness-analysis` |

A generic skill like `harness-refuter` can adversarially verify a finding in any harness. A domain skill like `harness-ingest` only knows how to compile a research brief — it has no meaning outside the research loadout.

---

## What does not overlap

The meta-harness root (`package.json`, `meta/`, `harnesses.json`) contains no agent loop, no tools, and no mission state. It runs two classes of commands:

```bash
bun run create-harness <name>   # scaffold a new harness
bun run list-harnesses          # show registry
bun run harness-doctor          # meta-level health check
```

Veritas Research contains no registry management, no scaffolding pipeline, and no knowledge of other harnesses. It knows only its own domain, its own loadouts, and its own committed benchmarks.

They share the architecture. They do not share code.
