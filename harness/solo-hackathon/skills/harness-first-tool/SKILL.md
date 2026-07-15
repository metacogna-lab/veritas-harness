---
name: harness-first-tool
description: >-
  Add the first real capability to THIS harness. Use when the operator asks to
  "add a tool", "wire a provider", "give the harness a capability", or "make the
  harness do something real" in a freshly scaffolded harness. Harness-specific:
  it operates on this harness's own src/tools and src/llm.
---

# Add this harness's first real tool

This harness was scaffolded with a scripted backbone and a single `read_file`
tool so its tests pass with no network. Turn it into a working harness.

## Steps

1. **Wire a real provider.** Replace `ScriptedBackbone` usage with a real
   transport behind `LLMBackbone` (`src/llm/types.ts`). Keep the interface — only
   add an implementation. Read the key from the environment; never hardcode it.

2. **Add a tool** in `src/tools/`:
   - zod `inputSchema` validated at the boundary.
   - `riskTier`: side effects ⇒ at least `active`. Network/write/exec ⇒ declare
     `scopeTargets(input)` so the scope gate can rule on it.
   - `run()` returns an observation string; never throw past the loop.
   - Register it on the `ToolRegistry` used by your control-plane verb.

3. **Test first (TDD).** Add a co-located `*.test.ts` that exercises the tool
   through `ToolRegistry.execute()` with `scopeOnlyCheck` — assert an in-scope
   call succeeds and an out-of-scope call returns `SCOPE DENIED`.

4. **Verify.** `bun test` must be green before you mark this done. Then
   `bun run dev smoke` should exercise the new path.

## Done criteria

- [ ] Real provider wired; key read from env.
- [ ] New tool registered with a zod schema and correct risk tier.
- [ ] Co-located test passes (in-scope allow + out-of-scope deny).
- [ ] `bun test` green.
