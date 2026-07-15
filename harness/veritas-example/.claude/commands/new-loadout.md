Scaffold a new Loadout named `$ARGUMENTS` for domain `$ARGUMENTS`.

Follow plan `agents/plans/02-phase-int.md` §2.1:
- Add specialists + tool allowlist in `harness/veritas-example/src/agent/specialists.ts` or a new loadout module
- Register a target adapter for the domain scope model
- Register in `harness/veritas-example/src/agent/loadouts.ts`
- Add tests proving the loadout differs from existing ones while sharing the same loop

Do not fork the agent loop. `bun test` must be green before finishing.
