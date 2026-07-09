---
name: harness-tool-adder
description: >-
  Add a new tool to the Veritas harness ToolRegistry. Use when the user asks to
  "add a tool", "give the agent the ability to X", "new capability", register a
  tool, or extend what the agent can do. Enforces risk tiers, scope gate coverage,
  and tests before marking done.
---

# Harness Tool Adder

Add a capability to the harness by registering a typed tool — never by forking the agent loop.

## Steps

1. Read `harness/veritas-research/src/tools/registry.ts` for the `Tool` interface, `RiskTier`, and `execute()` flow (validate → safety check → run).
2. Read existing tools in `harness/veritas-research/src/tools/` (`read-file.ts`, `http-get.ts`, etc.) for naming and pattern.
3. Create `harness/veritas-research/src/tools/<name>.ts`:
   - `name`, `description`, zod `inputSchema`
   - Conservative `riskTier`: side-effecting read-only I/O is at least `active`; `intrusive` / `credential` / `dangerous` MUST use tiers that force the approval gate
   - `scopeTargets(input)` when the tool touches network, filesystem, or shell
   - `requiresHumanRelease: true` + `terminalActionKind` for publish/send/delete/deploy/disclose actions
4. If the tool touches network/fs/shell, confirm `src/safety/scope.ts` `checkScope` covers the target kinds; add a scope test case if a new pattern appears.
5. Register the tool in `harness/veritas-research/src/tools/index.ts` (or a loadout-specific subset if domain-only).
6. Write `harness/veritas-research/src/tools/<name>.test.ts`:
   - Happy path execution
   - At least one scope-denied path (off-scope target → `SCOPE DENIED`, no side effect)
7. Run from `harness/veritas-research/`:

```bash
bun test src/tools/<name>.test.ts
bun test
```

## Hard rules

- **NEVER** register a dangerous tool without a `riskTier` that forces the approval gate (`intrusive`, `credential`, or `dangerous`).
- **NEVER** bypass `ToolRegistry.execute()` — all tools go through the safety gate.
- **Compose, don't fork** — do not duplicate the agent loop.

## Don't mark done until

`bun test` is green for the new tool file and the full suite. Report the `riskTier` chosen and why before finishing.
