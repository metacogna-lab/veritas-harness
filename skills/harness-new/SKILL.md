---
name: harness-new
description: >-
  Create a new harness under harness/<name> via the ordered create-harness
  pipeline. Use when the user asks to "create a harness", "new harness", "scaffold
  a harness", "add a harness for X", "start a new project harness", or run
  /new-harness. This is a META skill — it builds a whole harness, not a tool.
---

# Create a new harness

Every new harness is created through the pipeline so the registry, manifest, and
1-based index stay consistent (invariant #4). Never hand-create a harness folder.

## Steps

1. Pick a **kebab-case** name and any capability packs. List available packs:
   ```bash
   bun run create-harness   # prints usage + available capability packs
   ```
2. Run the pipeline from the repo root:
   ```bash
   bun run create-harness <name> --capabilities <a,b>
   ```
   It progresses in order: validate → scaffold the 8-plane template → install
   capability-pack skills into `harness/<name>/skills/` → write `harness.json` →
   register in `harnesses.json` → `bun install` → `bun test`. It refuses to proceed
   if the name is invalid, already registered, or the directory exists.
3. Confirm the result:
   ```bash
   bun run list-harnesses     # new harness appears with its index
   bun run harness-doctor     # meta layer still healthy
   ```
4. Enter the harness and make it real — wire a provider and the first tool. The
   installed **harness-first-tool** skill (from a capability pack) walks through
   this; **harness-tool-adder** and **harness-provider** apply once it is live.

## Done criteria

- [ ] `bun run create-harness` exited ✅ (install + test green in the new harness).
- [ ] `bun run harness-doctor` is green.
- [ ] The new harness is listed with the next sequential index.
