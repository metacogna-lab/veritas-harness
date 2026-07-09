# Veritas Ingest

Compile research intent from `NEW.md` into a harness-ready `research-plan.json`.

## Quick start

1. Copy the example or author your brief:
   ```bash
   cp ingest/examples/scope-gate-study.NEW.md ingest/NEW.md
   # edit ingest/NEW.md
   ```

2. Run ingest:
   ```bash
   cd harness/veritas-research
   bun run ingest --input ingest/NEW.md
   ```

3. Start a mission from the plan:
   ```bash
   bun run dev start --plan missions/<slug>/research-plan.json
   ```

## Files

| File | Purpose |
|------|---------|
| `ingest/NEW.md` | Operator research brief (gitignored) |
| `ingest/TEMP.md` | Template spec for LLM fitter |
| `ingest/examples/*.NEW.md` | Committed example briefs |
| `src/ingest/schema.ts` | Zod schema (shared with harness) |

Output lands in `missions/<slug>/research-plan.json`.

## Tests

```bash
bun test src/ingest/
```
