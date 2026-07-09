# Meta-harness skills (generic — for the harness system, not one harness)

These skills operate the harness *system*: they create harnesses and run
capabilities that every harness shares (init, provider, config, tool-adder,
refuter, eval-runner). They live at the meta root because they are **not** specific
to any single harness (invariant #3).

Harness-*specific* skills (e.g. research ingest/analysis) do **not** live here.
They ship as capability packs under `meta/templates/skills/<pack>/` and are
initialized into `harness/<name>/skills/` at creation time by the create-harness
pipeline. See `harness/veritas-research/skills/` for harness #1's owned skills.

## Target-harness resolution

Every skill below acts on one harness under `harness/`. Wherever a step writes
`harness/<harness>`, resolve `<harness>` like this:

1. If the invocation names a harness (argument), use it.
2. Else if exactly one harness is registered in `harnesses.json`, use that one.
3. Else run `bun run list-harnesses` and ask which harness to target.

| Skill | Purpose |
|-------|---------|
| `harness-new` | Scaffold a new harness via the ordered create-harness pipeline |
| `harness-init` | Onboard/verify a harness from clone to first mission |
| `harness-provider` | Show provider/model info for a harness |
| `harness-config` | Interactive config wizard → `src/config/local.json` |
| `harness-tool-adder` | Register a new typed tool in a harness |
| `harness-refuter` | Verify a finding before it is reported confirmed |
| `harness-eval-runner` | Run/add committed-oracle benchmark suites |
