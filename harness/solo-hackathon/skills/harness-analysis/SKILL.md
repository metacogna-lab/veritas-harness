---
name: harness-analysis
description: >-
  Produce a structured research analysis report from all harnesses. Use when the user
  asks to "analyze harnesses", "generate a research summary", "write a research report",
  "summarize mission results", "what did the harness find", or run /analyze. Writes
  analysis/research-analysis-{datetime}.md at repo root.
---

# Harness Analysis

Generate a deep-review report synthesising claims, bench results, lessons, missions,
and recent changes across all harnesses under `harness/`.

## Steps

1. Confirm the harness is healthy:
   ```bash
   cd harness/<harness>
   bun run doctor
   bun test
   ```
2. Run the analysis script:
   ```bash
   bun run analyze
   ```
   Or preview without writing:
   ```bash
   bun run analyze --dry-run
   ```
3. Open `analysis/research-analysis-{datetime}.md` (printed to stdout in dry-run mode).
4. Review each harness section:
   - **SUMMARY**: claims verified, bench pass@1, lessons, active missions
   - **CHANGES**: recent commits — does recent history align with current objectives?
   - **CURRENT HYPOTHESIS**: active research direction from ingested plans
5. Identify gaps: missing bench suites, unconfirmed findings, stale missions, lessons not
   yet acted on.
6. If the user wants to act on a gap:
   - Unconfirmed finding → use **harness-refuter**
   - Missing bench suite → use **harness-eval-runner**
   - Missing capabilities → use **harness-tool-adder**
   - Outdated research plan → use **harness-ingest**

## Report structure

```markdown
# OVERALL SUMMARY (All harnesses)
[Cross-harness aggregate: counts, branch, commit]

---

# {harness-name} (harness/{name})

## SUMMARY
Claims | Bench | Lessons | Missions

### Claims
### Benchmark Results
### Ingested Missions
### Lessons

## CHANGES
Recent git commits touching this harness

## CURRENT HYPOTHESIS
Active objectives from ingested plans + safety property status
```

## Composing with other skills

- **harness-refuter**: act on unconfirmed findings surfaced in the SUMMARY section
- **harness-eval-runner**: add bench suites for any capability without a committed oracle
- **harness-ingest**: update or add a research plan if CURRENT HYPOTHESIS is stale
- **harness-tool-adder**: address capability gaps called out in lessons or findings

## Hard rules

- The report reads committed artifacts only — it never executes LLM calls.
- `analysis/` outputs are informational; they do not modify harness source or mission logs.
- Produced files are time-stamped and append-only — never overwrite an existing report.

## Don't mark done until

`bun run analyze` exits 0 and `analysis/research-analysis-*.md` exists with non-empty
OVERALL SUMMARY, SUMMARY, CHANGES, and CURRENT HYPOTHESIS sections for each harness.
