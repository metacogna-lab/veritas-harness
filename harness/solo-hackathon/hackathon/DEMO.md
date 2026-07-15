# DEMO PACKAGE (Step 4)

## What to show

1. **Kit index** — `harness/solo-hackathon/HACKATHON.md`
2. **Framing trio** — `hackathon/PROBLEM.md`, `CONSTRAINTS.md`, `SUCCESS.md`
3. **Harness identity** — `harness.json` + `HARNESS_SPEC.json` + loadout name `solo-hackathon`
4. **Proof of spine** — smoke output + test count

## Demo script (≈ 3 minutes)

```bash
cd harness/solo-hackathon
bun ./src/cli.ts loadouts
bun ./src/cli.ts smoke
bun test
ls hackathon/
```

Say out loud: "One sitting, one kit, one loadout — files first, then build."

## Artefact paths (fill/confirm)

| Artefact | Path |
|---|---|
| Spec | `agents/specs/solo-hackathon.json` |
| Pack index | `harness/solo-hackathon/HACKATHON.md` |
| Kit dir | `harness/solo-hackathon/hackathon/` |
| Mission result | `harness/solo-hackathon/step1-mission-result.json` (and later step results) |
| Run summary | `logs/solo-hackathon-run-*.md` |

## Out of demo

- `node_modules/`
- Provider credentials
- Unrelated RSI / interactive CLI WIP
