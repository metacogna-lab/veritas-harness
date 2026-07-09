# Part 1: Create a harness

The repo root is a meta-harness. It owns a registry, a scaffold template, and generic operating skills. Individual harnesses live under `harness/<name>/`. Each one is a self-contained package with its own loop, safety gates, and CLI.

You do not hand-create a harness folder. The meta layer runs an ordered pipeline so every harness gets the same eight-plane spine, a manifest, and the next sequential index in the registry.

## Steps

From the repo root:

```bash
bun install
bun run create-harness
```

The bare command prints usage and the available capability packs (`research`, `starter`, and others). Pick a kebab-case name and any packs you need:

```bash
bun run create-harness my-study --capabilities research
```

The pipeline progresses in order: validate the name, copy the template into `harness/my-study/`, install capability-pack skills, write `harness.json`, register in `harnesses.json`, run `bun install`, run `bun test`. It stops if the name is invalid, already registered, or the directory exists.

Confirm the result:

```bash
bun run list-harnesses
bun run harness-doctor
```

You should see your harness listed with an index number. `harness-doctor` checks the meta layer is healthy.

## Skip creation

If you only want the canonical research harness today, use the one that already exists:

```bash
bun run list-harnesses
# veritas-research  index 1  harness/veritas-research
```

Continue to [02-init.md](02-init.md) with `cd harness/veritas-research` (or `cd harness/<your-name>` if you created one).

The registry and scaffold are what make every harness composable on the same spine. You swap tools, loadouts, and target adapters. You never fork the loop.
