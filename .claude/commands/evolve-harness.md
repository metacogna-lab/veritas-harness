---
description: Run the RSI outer loop on a harness to mine failure patterns, propose loadout improvements, evaluate the candidate against committed bench baselines, and surface a human-review packet. Nothing is applied automatically.
argument-hint: "[<harness-name>] [--last-n <N>] [--suite <bench-suite>]"
---

Evolve the harness using the harness-evolver skill.

Target harness: $ARGUMENTS (defaults to first in harnesses.json if omitted).

Use the **harness-evolver** skill from `skills/harness-evolver/SKILL.md`:

1. Resolve the target harness from $ARGUMENTS or harnesses.json default.
2. Survey `harness/<name>/resources/experience/` — stop if empty.
3. Read the current loadout from `harness/<name>/src/agent/loadouts.ts`.
4. Run the RSI dry-run pipeline (experience store → weakness mining → proposal → validation).
5. Evaluate the candidate: `bun run verify-harness-candidate` — stop on REJECT.
6. Write `harness/<name>/loadout-candidate/` with proposed-loadout.ts + reasoning.md.
7. Print the human review packet with explicit next-step instructions.

Safety constraints (never relaxed):
- `src/safety/` files are NEVER editable surfaces (hard stop).
- Dry-run only — no policy that auto-releases is ever wired.
- Honest decomposition — proposer always sees the real task description.
