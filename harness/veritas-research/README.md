# veritas-research

Exploratory **spawned** harness: a runnable rich 8-plane spine with **no domain
loadouts**. It is not the scaffold source of truth and contains **no harness-creation
pipeline**.

| Role | Location |
|------|----------|
| Create / register harnesses | Repo root — `bun run create-harness` (`meta/`) |
| Template copied by create-harness | `meta/templates/harness-template/` |
| Research domain (ingest, RSI, loadouts, bench scripts) | `harness/veritas-example/` |

```bash
bun install
bun test
bun src/cli.ts planes
bun run doctor
```

Add a domain by registering a Loadout (compose, don't fork), or spawn a new package
with `bun run create-harness <name> [--from-spec path/to/spec.json]` from the repo root.
