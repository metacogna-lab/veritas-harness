---
name: harness-evolver
description: >-
  Evolve a harness's loadout by running the RSI outer loop against its experience
  store. Use when the user asks to "evolve the harness", "improve the loadout",
  "run RSI", "mine weaknesses from past missions", "propose harness edits", or
  "review harness candidate". Operates on ANY registered harness (generic meta skill).
argument-hint: "[--harness <name-or-path>] [--last-n <N>] [--suite <bench-suite>]"
---

# Harness Evolver

Bi-level outer loop: mines failure patterns from the experience store, proposes
bounded loadout edits, evaluates candidates against committed bench baselines, and
surfaces a human-review packet. Nothing is applied autonomously — the human releases.

## Prerequisites

```bash
# From the meta root
bun run list-harnesses           # confirm the target harness is registered
cd harness/<name>
bun run doctor                   # provider + PATH healthy
bun test                         # all tests green
bun run bench                    # baseline results.json committed
```

## Steps

### 1. Resolve the target harness

- Default: first entry in `harnesses.json` (usually `veritas-research`).
- Explicit: `--harness <name>` matches `harnesses.json` by name; `--harness <path>`
  accepts an absolute path directly.
- Read `harness/<name>/harness.json` to confirm the 8-plane manifest is intact.

### 2. Survey the experience store

```bash
ls harness/<name>/resources/experience/
```

- If the directory is empty or missing: tell the user no missions have been recorded
  yet and stop. The evolver needs at least one completed mission to mine from.
- For each mission directory, read `entry.json` to collect: loadout, toolNames,
  scopeHosts, recordedAt, scores.
- Read any `failure-clusters.md` files already written by prior RSI runs.

### 3. Read the current loadout

- Open `harness/<name>/src/agent/loadouts.ts` (or `specialists.ts` if that is where
  the loadout is defined — check both).
- Identify: specialist roles, system prompts, tool allowlists, target adapter config.
- Note any surfaces listed in `CLAUDE.md` as never-editable (safety plane files).

### 4. Invoke the RSI pipeline

Run a dry-run RSI pass via the harness CLI or directly in TypeScript:

```bash
cd harness/<name>
# Using experience store (last N missions, or all):
bun run dev rsi --last-n ${LAST_N:-5} --dry-run
```

If the harness CLI does not expose an `rsi` verb yet, call the pipeline directly:

```typescript
import { runRsi } from "./src/rsi/run.ts";
import { LessonsStore } from "./src/resources/lessons.ts";
// ... wire up editableSurfaces, suite, proposer (use claude-opus-4-8 or strongest available)
const result = await runRsi({ lastN: 5, experienceStoreRoot: "resources/experience", ... });
```

Key constraints (never relax these):
- `editableSurfaces` must NOT include any file under `src/safety/` — the safety
  plane is never a candidate for RSI edits.
- The proposer must receive an honest task description (invariant #7); use the
  `buildProposalContext` + `assertHonestContext` pair.
- `policy` is absent → dry-run by default. Do NOT wire a `policy` that auto-releases.

### 5. Evaluate the candidate against the bench baseline

```bash
cd harness/<name>
bun run verify-harness-candidate --candidate src/config/local.json --suite <suite>
```

Read `bench/<suite>/candidate-results.json` for the decision:
- `promote` → candidate is safe to offer for human review.
- `hold` → mild regression; surface to the user with the delta.
- `reject` → candidate regresses; do NOT surface it as a promotion. Report what
  broke and stop.

### 6. Produce the loadout candidate

Write the proposed loadout change to `harness/<name>/loadout-candidate/`:

```
harness/<name>/loadout-candidate/
  proposed-loadout.ts      # new or modified TypeScript loadout file
  reasoning.md             # RSI rationale: which failure pattern, why this edit
  candidate-eval.json      # copy of candidate-results.json
```

`reasoning.md` must include:
- The failure pattern signature and count
- The editable surface targeted
- Why this edit addresses the pattern (reference grounded failures by mission + seq)
- Which prior lessons informed the proposal (if any)
- The bench eval decision and delta

### 7. Surface the human review packet

Print a structured summary:

```
=== Harness Evolver: <harness-name> ===
Failure patterns mined: <N>
Proposals generated: <N>
Candidate bench decision: PROMOTE / HOLD / REJECT
Review packet written to: harness/<name>/loadout-candidate/

Next step (human):
  1. Review harness/<name>/loadout-candidate/proposed-loadout.ts
  2. Apply the diff on a branch: git checkout -b rsi/<date>
  3. Run bun test && bun run bench to verify
  4. Open a PR for team review
  The harness will NOT apply this for you (invariant #5).
```

## Composing with other skills

- Run **harness-eval-runner** first to ensure bench baselines are current.
- After the human applies the proposed diff, run **harness-eval-runner** again to
  confirm the improvement is real (not overfit).
- Use **harness-refuter** to verify any findings cited as evidence in `reasoning.md`.

## Standing rules

- Safety plane (`src/safety/`) is NEVER an editable surface for RSI. Hard stop if
  any proposed edit targets it.
- Honest decomposition (invariant #7): the proposer model always sees the real task.
  Never build a wrapper that obscures the objective.
- Dry-run only: `policy` is never set by this skill. The human releases.
- Nothing is written to the harness source files; output goes to `loadout-candidate/`
  only.

## Don't mark done until

- [ ] Experience store survey completed (or user told why it's empty).
- [ ] RSI dry-run completed with no safety-plane surfaces in editableSurfaces.
- [ ] `bun run verify-harness-candidate` exits 0 (promote or hold, not reject).
- [ ] `loadout-candidate/` written with proposed-loadout.ts + reasoning.md.
- [ ] Human review packet printed with explicit "next step" instructions.
