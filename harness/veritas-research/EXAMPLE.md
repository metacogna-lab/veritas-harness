# Veritas — Step-by-Step Example

From a fresh clone to a confirmed finding in under ten minutes.

---

## 1. Install and verify

```bash
cd harness/veritas-research
bun install
export ANTHROPIC_API_KEY=sk-ant-...   # or configure local.json (see PROVIDER.md)
bun run doctor
bun test
```

`doctor` should show all ✅ (the provider credential warning is OK if you set the key above).
`bun test` should report 180 pass.

---

## 2. Run a quick mission

List available loadouts, then audit this repo's own source tree:

```bash
bun run dev loadouts
# codebase-audit — Read and summarize/audit a codebase within a filesystem scope.
# web-recon      — Gather information from a set of explicitly authorized web hosts.
# research        — Structured research missions driven by an ingested research-plan.json.

bun run dev start "Summarise the top-level structure of this harness" \
  --loadout codebase-audit \
  --target src/
```

The agent runs a ReAct loop — propose action → scope check → execute tool → observe — until
it records a finding or exhausts its step budget. Output streams to your terminal.

Check the result:

```bash
bun run dev status <mission-id>    # one-line summary
bun run dev report <mission-id>    # full markdown report with confirmed findings
```

Mission artifacts land under `.veritas/runs/<id>/`.

---

## 3. Write a research brief and ingest it

Create `ingest/NEW.md` (see `ingest/examples/scope-gate-study.NEW.md` for the format):

```markdown
---
title: "Understand the safety approval gate"
slug: approval-gate-study
author: operator
created: 2026-07-09
loadout_hint: research
target_hint: src/safety
---

## Question
How does the approval gate decide which risk tiers require human sign-off?

## Scope
In: src/safety/
Out: anything outside src/safety/

## Success criteria
- Summarise the tier hierarchy (safe → active → intrusive → credential → dangerous)
- Identify which tiers fire the approval callback
```

Compile it into a validated research plan:

```bash
bun run ingest --input ingest/NEW.md
# ingest: wrote missions/approval-gate-study/research-plan.json
#   objective: How does the approval gate decide which risk tiers require human sign-off?
#   loadout: research
```

Validate the plan against 8 research-dogma dimensions before executing:

```bash
bun run dev eval --plan missions/approval-gate-study/research-plan.json
# ## Plan Eval: approval-gate-study
# Status: ✅ PASS  Score: 87%
# | falsifiable-question | required | ✅ | objective is specific and substantial |
# | bounded-scope        | required | ✅ | scope bounded: paths=src/safety/       |
# | phased-approach      | required | ✅ | 2 phases defined                       |
# | measurable-success   | required | ✅ | 1 measurable criterion/criteria found  |
```

If required dimensions fail (e.g. only 1 phase, vague objective), fix the brief and
re-run `bun run ingest`. Digest sources into summaries organised by idea:

```bash
bun run dev digest --plan missions/approval-gate-study/research-plan.json
# digest: reading agents/docs/processed/strategy.md
# digest: summarising agents/docs/processed/strategy.md
# digest: wrote resources/summary/approval-gate-study/strategy.md
# digest: synthesising 1 source(s)
# digest: wrote resources/summary/approval-gate-study/synthesis.md
```

Start the mission (eval + digest run automatically before the agent loop):

```bash
bun run dev start --plan missions/approval-gate-study/research-plan.json
```

---

## 4. Verify a finding

After the mission, promote any proposed finding through the refuter — a second model
instance that tries to disprove it using only committed evidence:

```bash
bun run verify-finding --fixture bench/int-smoke/mission.json
# finding: "app.ts exposes a debug flag" → confirmed (refuter could not disprove)
```

---

## 5. Run the benchmark suite

Check that scope-gate safety properties hold at their committed oracle:

```bash
bun run bench scope-gate
bun run verify-claims
# ✅ scope-gate-black-pass-at-1   stated=1 derived=1
# ✅ scope-gate-white-pass-at-1   stated=1 derived=1
```

---

## 6. Generate a research summary

Produce a timestamped Markdown report across all harnesses:

```bash
bun run analyze
# analyze: wrote ../../analysis/research-analysis-2026-07-09T....md
```

Open `analysis/research-analysis-*.md` for a full view of claims, bench results, lessons,
and current hypotheses.

---

## 7. Extend the harness

Add a new tool (use `/add-tool` or follow `skills/harness-tool-adder/SKILL.md`):

```bash
# Example: register a shell-exec tool (dangerous tier — requires approval gate)
# Never bypass ToolRegistry.execute(); always wire a riskTier.
```

Add a new loadout — the only three things that change per domain:

1. Register tools in `src/tools/` (or reuse existing ones).
2. Add a `Loadout` in `src/agent/loadouts.ts` with specialists and a target adapter.
3. Run `bun test` to confirm nothing broke.

The loop, gates, ledger, refuter, and control plane stay unchanged.

---

## Key commands at a glance

| Command | What it does |
|---------|-------------|
| `bun run doctor` | Environment healthcheck |
| `bun run dev start "<obj>" --loadout <l> --target <t>` | Run a mission |
| `bun run dev start --plan missions/<slug>/research-plan.json` | Run from an ingested plan |
| `bun run dev status <id>` | One-line mission status |
| `bun run dev report <id>` | Full mission report |
| `bun run ingest --input ingest/NEW.md` | Compile brief → research-plan.json |
| `bun run dev eval --plan <path>` | Check plan against 8 dogma dimensions |
| `bun run dev digest --plan <path>` | Digest sources → resources/summary/<slug>/ |
| `bun run verify-finding --fixture <path>` | Refute a finding against committed evidence |
| `bun run bench <suite>` | Run a benchmark suite |
| `bun run verify-claims` | Re-derive all headline numbers |
| `bun run lessons list` | List recorded mission lessons |
| `bun run analyze` | Generate analysis/research-analysis-*.md |
