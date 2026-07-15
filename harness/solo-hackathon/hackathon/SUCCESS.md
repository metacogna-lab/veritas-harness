# SUCCESS CRITERIA

A solo-hackathon sitting is **done** when all of the following are true:

1. **Kit complete** — every file listed in `HACKATHON.md` exists under `hackathon/` and is non-empty.
2. **Agreement** — `PROBLEM.md`, `CONSTRAINTS.md`, and `SUCCESS.md` do not contradict each other (same sitting length, same in/out of scope).
3. **MVP named** — `MVP.md` names one vertical slice with an explicit "done when" line.
4. **Demo-ready outline** — `DEMO.md` lists the artefact path(s) a reviewer would open.
5. **Harness green** — `bun test` in `harness/solo-hackathon` passes; `bun ./src/cli.ts loadouts` shows `solo-hackathon`.
6. **Provenance** — a mission log / `step*-mission-result.json` records that the kit was surveyed via a real tool observation (not vibes).

## Not sufficient alone

- Fancy prose without a shippable slice
- Checklist boxes ticked without files on disk
- Registry entry without a runnable harness
