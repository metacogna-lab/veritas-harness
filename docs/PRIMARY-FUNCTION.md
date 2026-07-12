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

## Veritas Research (harness #1) — pure 8-plane template

`harness/veritas-research/` is the **runnable reference implementation** of the 8-plane spine. It contains only generic infrastructure — no domain loadouts, no ingest pipeline, no RSI, no bench suites.

It provides:

- The **ReAct agent loop** (`src/agent/`) backed by the full safety spine
- The **`LoadoutRegistry`** class and `Loadout`/`Specialist`/`TargetAdapter` interfaces — the composition points for adding domains
- The **evidence ledger and refuter** (`src/evidence/`) — provenance gate + adversarial second model
- The **MCP server** (`src/mcp-server.ts`) — scope-gated, safe subset; loadouts injected at construction
- Generic scripts: `doctor.mjs`, `veritas-config.mjs`
- **Docker files**: `Dockerfile`, `docker-compose.yml`
- **No concrete loadouts** — `bun src/cli.ts loadouts` prints `(no loadouts registered)` by design

When you need to run a real mission, use veritas-example (or create your own harness from this template).

---

## Veritas Example (harness #2) — research domain harness

`harness/veritas-example/` is the **concrete domain harness** demonstrating end-to-end Veritas usage. It extends the 8-plane template with everything the research domain needs.

It provides:

- Three **loadouts** (`src/agent/loadouts.ts`):
  - `codebase-audit` — read-only filesystem audit; tools: `read_file`, `list_dir`, `record_finding`
  - `research` — structured missions driven by an ingested research plan; tools: `read_file`, `list_dir`, `http_get`, `record_finding`
  - `web-recon` — information gathering from authorised hosts; tools: `http_get`, `record_finding`
- The **ingest pipeline** (`bun run ingest`) — compiles a `NEW.md` brief into a validated `research-plan.json`
- The **RSI outer loop** (`/evolve-harness`) — mines failure patterns, proposes loadout edits, validates against committed benchmarks; never self-applies
- The **experience store** (`resources/experience/`) and **lessons delta store** (`resources/lessons.json`)
- Two harness-specific skills: `harness-ingest`, `harness-analysis`
- **Docker files**: `Dockerfile`, `docker-compose.yml` (with mission + experience volume mounts)
- Guided walkthrough in `EXAMPLE.md`

---

## The split

The previous dual role of veritas-research (template + domain harness) has been separated:

| | veritas-research | veritas-example |
|---|---|---|
| Role | 8-plane template / infrastructure reference | Research domain harness |
| Loadouts | None (inject your own) | codebase-audit, research, web-recon |
| Domain code | None | ingest, RSI, resources, memory/context-window |
| Skills | None | harness-ingest, harness-analysis |
| `bun test` | 178 tests (pure infrastructure) | 243 tests (includes domain) |

The template harness is the proof the 8-plane architecture composes. The domain harness is the proof it runs real missions.

The skills are partitioned to make the boundary explicit:

| Location | Scope | Examples |
|----------|-------|---------|
| `skills/` (meta root) | Any harness | `harness-tool-adder`, `harness-refuter`, `harness-evolver` |
| `harness/veritas-example/skills/` | Research domain only | `harness-ingest`, `harness-analysis` |

---

## What does not overlap

The meta-harness root (`package.json`, `meta/`, `harnesses.json`) contains no agent loop, no tools, and no mission state. It runs two classes of commands:

```bash
bun run create-harness <name>   # scaffold a new harness from the 8-plane template
bun run list-harnesses          # show registry
bun run harness-doctor          # meta-level health check (both harnesses must pass)
```

Neither harness contains registry management, scaffolding pipeline, or knowledge of other harnesses. They share the architecture. They do not share code.
