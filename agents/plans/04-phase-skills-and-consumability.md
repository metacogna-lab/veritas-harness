# Plan 04 — Skills and Consumability Layer

Goal: make the harness self-extending (Skills) and make it usable by both humans and other
agents (Consumability). These two phases are combined here because neither is safe to build
before ADV lands — skills that add tools or run evals need the full safety/evidence/refuter
spine already in place to enforce their own rules.

Dependencies: Phase ADV's DoD is met (`03-phase-adv.md`).

## Part A — Skills (`skills/`)

Each skill is a directory with a `SKILL.md` (front-matter + instructions) plus optional
helper scripts. Design rule for all three: trigger-rich `description`, imperative and
verifiable steps, and a hard "don't mark done until tests are green" gate at the end.

### 4.1 `skills/harness-tool-adder/SKILL.md`
- [ ] Triggers: "add a tool", "give the agent the ability to X", "new capability"
- [ ] Steps: read `src/tools/registry.ts` for the `Tool` interface and existing patterns →
      create `src/tools/<name>.ts` (name, description, zod `inputSchema`, conservative
      `riskTier` — anything with side effects is at least `active`; anything
      intrusive/credential/dangerous MUST be gated) → if the tool touches network/fs/shell,
      confirm `checkScope` covers it, add a case if not → register in `src/tools/index.ts`
      → write `src/tools/<name>.test.ts` (happy path + a scope-denied path) → `bun test`
      green before marking done
- [ ] Hard rule baked into the skill text: NEVER register a dangerous tool without a
      `riskTier` that forces the approval gate

### 4.2 `skills/harness-eval-runner/SKILL.md`
- [ ] Triggers: "benchmark", "evaluate the harness", "add an eval", "measure pass@1"
- [ ] Steps: read `scripts/bench.mjs` for the runner contract → to add a suite, create
      `bench/<suite>/tasks.json` and `bench/<suite>/oracle.json` (committed ground truth;
      held-out tasks in a separate file) → grade only against the oracle, never a model
      self-report → run `bun run bench`, then `bun run verify-claims` to confirm the
      numbers re-derive → if `verify-claims` fails, the eval is not trustworthy — fix
      before reporting any number

### 4.3 `skills/harness-refuter/SKILL.md`
- [ ] Triggers: "verify this finding", "is this real", "confirm before reporting"
- [ ] Steps: load the finding and its provenance from the mission log → spawn a refuter
      (different model or temperature) prompted to DISPROVE the finding using ONLY the
      committed evidence → survives refutation → mark confirmed; fails → retract, logging
      the refuter's reason → never report a finding as confirmed if it lacks provenance
      (`evidenceGate`, 2.3) or was retracted

## Part B — Consumability layer

### 5.1 `CLAUDE.md` (already present at repo root; keep in sync)
- [ ] Confirm it states the non-negotiable rules, layout, and commands — update if any
      phase above changes a path or script name

### 5.2 Slash commands — `.claude/commands/`
- [ ] `add-tool.md`: *"Add a new tool named `$ARGUMENTS` to the harness's ToolRegistry
      using the harness-tool-adder skill. Pick the correct riskTier, wire the safety gate,
      register it, and add tests. Report the riskTier you chose and why before finishing."*
- [ ] `verify.md`: run the refuter skill against `$ARGUMENTS` (a finding id)
- [ ] `bench.md`: run the eval-runner skill against `$ARGUMENTS` (a suite name)
- [ ] `new-loadout.md`: scaffold a new Loadout (specialists + tool subset + target adapter)
      for `$ARGUMENTS` (a domain name), per `02-phase-int.md` §2.1

### 5.3 Subagents — `.claude/agents/`
- [ ] `refuter.md`: role `skeptic`, tools restricted to `Read, Grep` only, instructed to
      try to disprove a finding using only committed evidence, respond `CONFIRMED` with
      specific evidence lines or `RETRACT` with a reason, and never speculate beyond the
      committed evidence

### 5.4 MCP exposure — `src/mcp-server.ts`
- [ ] Expose a safe, scope-gated subset of the harness over MCP — e.g. a
      `run_[objective]` tool that starts a scoped mission and returns status
- [ ] Only non-dangerous, scope-gated capabilities are exposed; document the tool schema
      for each exposed capability
- [ ] Test: an MCP call attempting to bypass scope or trigger a gated tier is rejected the
      same way a direct call would be — the MCP surface does not create a safety bypass

## Definition of done

- [ ] All three `SKILL.md` files exist, are trigger-rich, and each has been exercised at
      least once (a tool added via the skill, an eval run via the skill, a finding refuted
      via the skill) with tests green
- [ ] `.claude/commands/` and `.claude/agents/refuter.md` exist and have been invoked at
      least once each
- [ ] `src/mcp-server.ts` exists, exposes a documented safe subset, and the
      no-safety-bypass-via-MCP test passes
- [ ] `CLAUDE.md` at the repo root accurately reflects the final layout and commands from
      all phases
