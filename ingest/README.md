# Veritas Ingest

Compile research intent from `NEW.md` into a harness-ready `research-plan.json`.

## Quick start

1. Copy the example or author your brief:
   ```bash
   cp ingest/examples/scope-gate-study.NEW.md ingest/NEW.md
   # edit ingest/NEW.md
   ```

2. Run ingest (from harness directory):
   ```bash
   cd harness/veritas-research
   bun run ingest --input ../../ingest/NEW.md
   ```

3. Start a mission from the plan:
   ```bash
   bun run dev start --plan missions/<slug>/research-plan.json
   ```

## Files

| File | Purpose |
|------|---------|
| `NEW.md` | Operator research brief (gitignored) |
| `TEMP.md` | Template spec for LLM fitter |
| `examples/*.NEW.md` | Committed example briefs |
| `src/schema.ts` | Zod schema (shared with harness) |

Output lands in `harness/veritas-research/missions/<slug>/research-plan.json`.

## Tests

```bash
cd ingest && bun test
```
