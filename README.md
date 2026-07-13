# 🔬 Veritas — The Research Meta-Harness

> **One loop. Any objective. Provenance before every claim.**

Veritas is an open-source **meta-harness**: a tiered, self-improving agent framework built on top of Claude Code. It gives you a safe, reproducible agent loop out of the box — then lets you stamp out specialised harnesses for any research or engineering objective without rewriting the core.

---

## 🧠 What's a meta-harness?

A **harness** is a single-purpose agent: one ReAct loop, one safety spine, one set of tools, one objective domain. Veritas is the **meta-harness** — the layer above that:

```
veritas/                        ← meta-harness root (you are here)
  harness/veritas-research/     ← harness #1 (research domain)
  harness/your-next-thing/      ← harness #2, scaffolded in one command
```

The meta-harness owns the **registry**, the **create-harness pipeline**, and the **generic operating skills**. Individual harnesses own their tools, specialists, and domain-specific skills. New capability domains are a new harness — never a fork of the loop.

---

## ✨ What's inside

| Layer | What it does |
|-------|-------------|
| **8-plane architecture** | Provider → Safety → Verification → Memory → Capability → Execution → Orchestration → Control — narrow interfaces, composable planes |
| **ReAct loop** | Propose action → safety gate → execute tool → observe → repeat → stop |
| **Safety spine** | Scope gate + approval tiers + human-release gate. Fail-safe deny by default. Nothing fires unattended. |
| **Evidence ledger** | Every finding must trace to a real tool observation. No grounded evidence = no claim. |
| **Adversarial refuter** | A second model instance tries to disprove each finding before it is confirmed. |
| **RSI outer loop** | Mine failure patterns from past missions → propose bounded edits → validate against committed benchmarks → human releases. Self-improvement is always human-gated. |
| **Experience store** | Queryable per-mission history (`entry.json`, `transcript.jsonl`, `findings.jsonl`) that feeds the RSI pipeline. |
| **Lessons delta store** | Tracks which lessons help or harm RSI proposals; auto-deprecates at 2:1 harm:helpful ratio. |
| **Bench harness** | Committed-oracle benchmarks with anti-fitting guard. Black-box and white-box pass@1 never blended. |

---

## 🚀 Quick start

**Prerequisites:** [Bun](https://bun.sh) · Node 18+ · `ANTHROPIC_API_KEY`

```bash
git clone https://github.com/metacogna-lab/veritas-harness.git
cd veritas-harness

# Meta layer
bun install
bun run list-harnesses        # see registered harnesses
bun run harness-doctor        # health check

# Harness #1 — veritas-research
cd harness/veritas-research
bun install
bun run doctor                # provider + PATH check
bun test                      # 256 tests, all green
bun run bench                 # rsi + scope-gate benchmarks
```

Run your first mission:

```bash
bun run dev start "summarise the RSI literature and identify open problems" \
  --target research/processed/
```

---

## 🏗️ Create a new harness

```bash
# From the repo root:
bun run create-harness my-domain
cd harness/my-domain
bun install && bun test
```

The pipeline scaffolds the full 8-plane spine, installs capability packs, writes `harness.json`, and registers the harness — in one command. Only three things change per domain: `src/tools/`, `src/agent/specialists.ts`, and the target adapter. Everything else reuses unchanged.

---

## 🛠️ Skills & slash commands

Meta-root skills (operate on any harness):

| Skill / Command | What it does |
|-----------------|-------------|
| `/new-harness` | Scaffold a new harness via the pipeline |
| `harness-init` | Onboard a harness from clone to first mission |
| `harness-tool-adder` | Register a new typed tool |
| `harness-refuter` | Adversarially verify a finding |
| `harness-eval-runner` | Run or add committed-oracle benchmark suites |
| `/evolve-harness` | RSI outer loop — mine failures, propose loadout edits, evaluate candidate, surface human review packet |

Harness-specific skills (veritas-research):

| Skill | What it does |
|-------|-------------|
| `/ingest` | Compile a research brief → `research-plan.json` |
| `harness-analysis` | Cross-mission research synthesis |

---

## 🔒 Safety invariants (never bypassed)

1. **Scope before action** — no side-effecting tool runs outside declared scope
2. **Fail-safe deny** — unattended gated tools are denied, not silently fired
3. **Provenance before claim** — no finding without a real observation behind it
4. **Refute before confirm** — a second model must fail to disprove before promoting
5. **Human before consequence** — terminal actions stop one step short; human releases
6. **Reproduce before report** — every headline number re-derives from committed artifacts
7. **Honest decomposition** — workers always see a truthful description of their subtask
8. **Compose, don't fork** — new domains are a new Loadout, never a copy of the loop

---

## 🤝 Contributing

This project is open source and **contributions are very welcome!** 🎉

Ways to get involved:

- 🐛 **Bug reports** — open an issue with a failing test or a repro
- 🔧 **New tools** — use the `harness-tool-adder` skill and open a PR
- 🧪 **New bench suites** — add `tasks.json` + `oracle.json` + `solver.mjs` under `bench/<suite>/`
- 🏗️ **New harnesses** — scaffold with `bun run create-harness`, build, and share
- 📖 **Docs & guides** — the `guides/` folder is always a good place to improve
- 🔬 **Research** — the RSI outer loop is designed to improve itself; share what works

Please read [`CLAUDE.md`](./CLAUDE.md) before contributing — it describes the build order, safety invariants, and directory contract that keep the meta-harness composable.

For full operational reference (deployment, Docker, Modal, runbooks) see [`docs/OPERATIONS_PLAN.md`](./docs/OPERATIONS_PLAN.md).

```bash
# Run everything before opening a PR:
bun run harness-doctor
cd harness/veritas-research && bun test && bun run bench && bun run verify-claims
```

---

## 📁 Repository layout

```
veritas/
  package.json              meta CLI: create-harness, list-harnesses, harness-doctor
  harnesses.json            harness registry
  meta/                     registry, manifest, scaffold, create-harness pipeline
  skills/                   generic meta skills (operate any harness)
  .claude/commands/         /new-harness, /evolve-harness and other slash commands
  harness/
    veritas-research/       canonical harness #1 — 8-plane template (reference)
      src/                  8-plane source (agent, safety, tools, evidence, rsi, …)
      bench/                committed-oracle benchmark suites
      scripts/              verify-claims, bench, doctor, verify-harness-candidate
    veritas-example/        harness #2 — research domain (runnable)
      src/                  loadouts, ingest, RSI, memory, telemetry
      skills/               harness-specific skills (ingest, analysis)
      resources/            lessons.json, experience store, source summaries
  core/                     shared domain abstractions (schema, dogma, eval, types)
  app/                      Next.js 15 web frontend (STEP 1 in browser)
  research/
    raw/                    source papers (markdown summaries committed, PDFs gitignored)
    processed/              structured digests, one per paper (canonical --target corpus)
    meta-analyses/          cross-paper synthesis outputs
  docs/                     operational documentation
    OPERATIONS_PLAN.md      full ops reference: deployment, Docker, Modal, runbooks
    CLI.md                  CLI flag reference
    USE-CASES.md            operator use-case walkthroughs
    PRIMARY-FUNCTION.md     primary function description
    DEPENDENCIES.md         research-grounded dependency analysis
  agents/
    plans/                  build plans
    config/                 operating mandate (agents-config.md)
    state/                  session state and build log
```

---

<p align="center">Built with <a href="https://claude.ai/code">Claude Code</a> · MIT License</p>
