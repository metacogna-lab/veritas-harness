# Solo Hackathon — File Pack Index

This pack is the deliverable of the **solo-hackathon** harness mission:
*create every file a single-person (solo) hackathon needs before the build sprint.*

| File | Step | Purpose |
|---|---|---|
| [PROBLEM.md](./hackathon/PROBLEM.md) | 1 | Problem statement |
| [CONSTRAINTS.md](./hackathon/CONSTRAINTS.md) | 1 | Time, tools, out-of-scope |
| [SUCCESS.md](./hackathon/SUCCESS.md) | 1 | Measurable success criteria |
| [MVP.md](./hackathon/MVP.md) | 2 | Smallest shippable vertical slice |
| [TIMELINE.md](./hackathon/TIMELINE.md) | 1–4 | Sitting schedule |
| [CHECKLIST.md](./hackathon/CHECKLIST.md) | 3 | Build checklist |
| [DEMO.md](./hackathon/DEMO.md) | 4 | Demo package |
| [AGENDA.md](./hackathon/AGENDA.md) | — | Session agenda |
| [DECISIONS.md](./hackathon/DECISIONS.md) | — | Judgment calls log |

## Mission objective (this pack)

> Frame and materialise a complete solo-hackathon kit so one builder can finish a sitting-sized artefact without inventing process mid-run.

## How to use

1. Read `hackathon/PROBLEM.md` + `CONSTRAINTS.md` + `SUCCESS.md` (Step 1 — done when these files exist and agree).
2. Lock the slice in `MVP.md` (Step 2).
3. Work the `CHECKLIST.md` items in order (Step 3).
4. Ship with `DEMO.md` (Step 4).

Re-verify with the harness:

```bash
cd harness/solo-hackathon
bun ./src/cli.ts loadouts
# then run scripts/verify-hackathon-files.ts (or the meta test runner)
```
