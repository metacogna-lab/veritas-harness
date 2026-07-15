# BUILD CHECKLIST (Step 3)

Work top-to-bottom. Do not reorder past a failed gate.

## Gates

- [ ] `bun ./src/cli.ts loadouts` lists `solo-hackathon`
- [ ] `bun ./src/cli.ts smoke` exits 0
- [ ] `bun test` exits 0
- [ ] All kit files present (see `HACKATHON.md` table)

## Build order

1. [ ] Re-read `MVP.md` — one slice only
2. [ ] Implement / finish the slice artefact
3. [ ] Add or update a minimal test if code changed
4. [ ] Record any judgment call in `DECISIONS.md`
5. [ ] Fill `DEMO.md` with concrete paths + one-liner demo script
6. [ ] Re-run smoke + tests

## Stop conditions

- Scope creep into other harnesses → stop, log in `DECISIONS.md`
- Need a dangerous/credential tool → stop (human-before-consequence)
- Sitting timer expired → ship whatever is demoable; mark unfinished checklist items
