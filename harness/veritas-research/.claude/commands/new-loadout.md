Scaffold a new Loadout named `$ARGUMENTS` for domain `$ARGUMENTS`.

Follow plan `agents/plans/02-phase-int.md` §2.1:
- Register specialists + tool allowlist via a `Loadout` on `LoadoutRegistry` (`src/agent/specialists.ts`)
- Prefer the research-domain example for concrete loadouts: `harness/veritas-example/src/agent/loadouts.ts`
- Or spawn a new harness: `bun run create-harness <name> --from-spec <spec.json>` (meta root)
- Add tests proving the loadout differs from existing ones while sharing the same loop

Do not fork the agent loop. Do not add harness-creation logic here. `bun test` must be green before finishing.
