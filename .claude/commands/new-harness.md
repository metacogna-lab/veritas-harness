---
description: Scaffold a new harness under harness/<name> via the ordered create-harness pipeline.
argument-hint: <name> [--capabilities a,b]
---

Create a new harness in this meta-harness repo using the ordered pipeline.

Run from the repo root:

```bash
bun run create-harness $ARGUMENTS
```

This progresses in order (validate → scaffold the 8-plane template → install
capability packs → write harness.json → register in harnesses.json → bun install →
bun test) and refuses to proceed if the name is not kebab-case, is already
registered, or the target directory exists.

After it completes:

1. `bun run list-harnesses` — confirm the new harness appears with its index.
2. `bun run harness-doctor` — confirm the meta layer is still healthy.
3. `cd harness/<name>` and follow its `README.md` to wire a real provider and the
   first real tool (the installed `harness-first-tool` skill walks through this).

Do not hand-create harness directories — always go through this pipeline so the
registry, manifest, and index stay consistent (invariant #4).
