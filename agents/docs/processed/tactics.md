# Tactics — Literal Build Steps

Source: *Building an Agent Harness with Claude Code* (the only one of the three source docs
written as an executable script — each phase pairs a Claude Code prompt with the artifact it
must produce). Stack: TypeScript + Node in source; this repo substitutes **Bun** per the
global package-manager mandate.

## 0. Project init

```
mkdir harness-[objective] && cd $_
git init && npm init -y
npm i eventemitter3 zod
npm i -D typescript tsx @types/node eslint
npx tsc --init
```//Bun equivalent: `bun init`, `bun add eventemitter3 zod`, `bun add -d typescript tsx @types/node eslint`

Directory contract to fill in:
```
src/
  llm/        # provider abstraction        (1.1)
  config/     # config + keys                (1.2)
  agent/      # ReAct loop                   (1.3)
  safety/     # scope + approval gates       (1.4, 2.2)
  tools/      # typed tool registry          (1.5)
  parse/      # robust output parsing        (1.6)
  mission/    # the mission object           (1.7)
scripts/      # verify, bench, doctor        (2.7, 3.2)
skills/       # SKILL.md capabilities        (Phase 4)
.claude/      # commands, subagents          (Phase 5)
```

## Phase 1 — BASIC

- **1.1 Provider abstraction** — `src/llm/index.ts`: `LLMBackbone` class with a single
  `complete()` method normalizing across providers. Config shape: `{ provider, model, apiKey?,
  baseUrl?, maxTokens, temperature }`. Providers: `'anthropic' | 'openai' | 'openrouter' |
  'local'`. Text-mode tool-calling shim for models without native function-calling. Retry with
  exponential backoff; `fallback` list of configs tried in order. Never log secrets. Returns
  `{ text, toolCalls[], usage }`. Test with a fake transport (no real network).
- **1.2 Config + keys** — `src/config/index.ts`: typed config loaded from env + optional
  `~/.harness/config.json`, `defaultProvider`, `AVAILABLE_MODELS` registry, env-var key
  resolution (never hardcode keys), `loadConfig()` + `redact()` helper masking secrets before
  logging.
- **1.3 The ReAct loop** — `src/agent/index.ts`: `Agent` class. Inputs: `LLMBackbone`,
  `ToolRegistry`, system prompt, a `Mission`, `maxSteps`. Each step: ask model for next action →
  tool call runs THROUGH the safety gate → observation fed back → repeat. Stop on explicit final
  answer or `maxSteps` (hard, non-negotiable ceiling). Emits typed events
  (`step`, `toolCall`, `observation`, `done`, `error`) via `eventemitter3`. Every tool result and
  model turn is written to the Mission's append-only log.
- **1.4 Scope gate** — `src/safety/scope.ts`: pure function `checkScope(call, mission)`. For any
  tool touching network/filesystem/shell, allow ONLY if the target is inside the mission's
  declared scope. Deny off-scope hosts/paths, loopback, and private ranges by default, reason
  string `"SCOPE DENIED: <detail>"`. No I/O in this module — fully unit-testable. **This belongs
  in BASIC, before any real tool is wired in.**
- **1.5 Tool registry** — `src/tools/registry.ts`: `Tool<I>` = `{ name, description,
  inputSchema: z.ZodType<I>, riskTier: 'safe'|'active'|'intrusive'|'credential'|'dangerous',
  run(input): Promise<string> }`. `register()`, `schemas()` (for the model), `execute(toolCall)`
  validates input against the zod schema THEN runs. Ship 2–3 inert `safe` starter tools only
  (e.g. `read_file`, scope-checked `http_get`, `list_dir`).
- **1.6 Robust output parsing** — `src/parse/json.ts`: `parseLastObject(text)` /
  `parseLastArray(text)`: strip fences, try a direct parse, then scan every balanced `{…}`/`[…]`
  span and return the LAST one that parses to the expected shape (the model's final answer).
  Never trust a naive `JSON.parse` on model output.
- **1.7 Mission object** — `src/mission/index.ts`: holds `id`, `objective`, `scope`
  (allowed hosts/paths), `status`, an append-only `transcript`, and a `findings` array. Methods:
  `record()` (immutable append), `transcript()`, `addFinding()`, `snapshot()`. Findings and
  transcript entries are never mutated after write.

✅ End of BASIC: a single agent that reasons, calls scope-checked tools, parses robustly, and
logs everything immutably. Smoke-test end-to-end against a trivial objective before proceeding.

## Phase 2 — INT

- **2.1 Specialist loadouts** — `src/agent/specialists.ts`: `Specialist = { role, systemPrompt,
  toolAllowlist }`. `Loadout = { specialists[], toolRegistrySubset, targetAdapter, benchmark? }`.
  New domains compose as a new Loadout, never a fork of the loop.
- **2.2 Approval gate + risk tiers** — `src/safety/approval.ts` (pure — host injects the
  approver + warning sink). `GATED_TIERS = {intrusive, credential, dangerous}`: inert until
  approved, approve-once-then-free per session. `SPICY_TIERS = {credential, dangerous}`: emit a
  loud audited warning on every call even when approved. Two approval paths: interactive (ask on
  first use) and pre-authorized (headless runs get an explicit allowlist up front; off-list
  denies; everything audited). **FAIL-SAFE**: a gated tool with no approver wired and not
  pre-approved is DENIED. Composition: `src/safety/index.ts check(call, mission, policy)` =
  `checkScope()` (1.4) then `requestApproval()` (2.2, fail-safe denies).
- **2.3 Evidence ledger + provenance gate** — `src/evidence/gate.ts`: a Finding must carry
  provenance (which tool call + which observation produced it). `evidenceGate(finding)` rejects
  any finding not backed by a real tool observation in the mission log — the antidote to model
  confabulation. `addFinding()` routes through the gate, append-only.
- **2.4 Adversarial verification (refuter)** — `scripts/verify-finding.mjs` +
  `src/evidence/refuter.ts`. Before a finding is promoted to "confirmed," a SEPARATE model
  instance (ideally different model/temperature) is prompted to disprove it using ONLY committed
  evidence. Survives → confirmed; fails → retracted with the refuter's reason logged. Highest-
  leverage quality mechanism in the whole harness.
- **2.5 Control plane** — `src/cli.ts` (tsx entry) + optional `src/server.ts` (HTTP API). CLI
  verbs: `start "<objective>" --scope <...>`, `status <id>`, `report <id>`. HTTP:
  `POST /api/mission/start`, `GET /api/mission/status`. A natural-language front door resolves a
  plain-English objective into a Mission + Loadout, then streams agent events to stdout/SSE.
- **2.6 Reproducibility guard** — `scripts/verify-claims.mjs`: re-derives every headline metric
  the harness reports from committed artifacts under `./bench` (JSON), exits non-zero if any
  number can't be reproduced. Wired as `npm run verify-claims` (→ `bun run verify-claims`) and a
  git pre-push hook (`.githooks/pre-push`). Principle: a claim that can't be reproduced doesn't
  ship.
- **2.7 Health check** — `scripts/doctor.mjs`: verifies Node/Bun version, that a provider is
  reachable (or a local model is up), required tools exist on PATH, config loads without
  exposing secrets. Human-readable ✅/❌ output, non-zero exit on failure.

`package.json` scripts to mirror (bun-adapted):
```json
{
  "scripts": {
    "dev": "tsx src/cli.ts",
    "build": "tsc",
    "doctor": "node scripts/doctor.mjs",
    "verify-claims": "node scripts/verify-claims.mjs",
    "verify-finding": "node scripts/verify-finding.mjs",
    "bench": "node scripts/bench.mjs",
    "test": "node --test"
  }
}
```

✅ End of INT: role-scoped specialists, dangerous actions gated behind a human with
fail-safe-deny, unprovenanced findings refused, conclusions self-refuted, numbers re-derived.

## Phase 3 — ADV

- **3.1 Multi-model orchestrator** — `src/orchestration/orchestrator.ts`: master-builder
  decomposes a large objective into independent sub-queries, dispatches to worker agents
  (possibly cheaper models) in parallel with bounded concurrency, synthesizes results over
  rounds with an accumulated-knowledge memory, context-packs each worker under a token budget.
  **Scope discipline**: workload-decomposition only (parallelism, cost, context budgeting). Do
  NOT design it to conceal the objective from, or route around the safety behavior of, any
  worker model — each worker sees an honest description of its subtask.
- **3.2 Benchmark harness** — `scripts/bench.mjs` + `bench/<suite>/`: tasks + a committed
  ground-truth oracle per task. Grades each result against the oracle (never a self-report),
  computes pass@1 with a Wilson-95 interval, writes results as committed JSON that
  `verify-claims` re-derives. Anti-fitting guard: fail the build if grading logic references the
  specific test answers, keep held-out tasks separate from tasks used to tune prompts. Report
  black-box and white-box variants separately; never blend.
- **3.3 Human-gated terminal actions** — for any consequential terminal action (sending,
  publishing, deleting, deploying, disclosing), the harness stops one step short and produces a
  draft/plan a human explicitly approves and executes. `requireHumanRelease(action)` checkpoint;
  test asserting the harness never auto-executes a terminal action.
- **3.4 Lessons / self-improvement loop** — `scripts/lessons.mjs` + `src/resources/lessons.ts`:
  after each mission, extract structured lessons (what worked, what failed, prompt/tool gaps)
  into a committed store. `retrieveLessons(objective)` so future mission planning can load
  relevant past lessons into context. Mark clearly which part is live (recording) vs. roadmap
  (auto-feedback into planning).

✅ End of ADV: plans across models honestly, benchmarks itself against committed oracles with an
anti-fitting guard, refuses to auto-fire consequential actions, accumulates lessons.

## Phase 4 — Skills (self-extension)

Three `SKILL.md` capabilities under `skills/`, each trigger-rich, imperative, and ending with a
hard "don't mark done until green" gate:

- **`harness-tool-adder`** — read `src/tools/registry.ts` → create `src/tools/<name>.ts`
  implementing `Tool` (name, description, zod inputSchema, conservative `riskTier` — anything
  with side effects is at least `active`, anything intrusive/credential/dangerous MUST be
  gated) → confirm `checkScope` covers it if it touches network/fs/shell → register in
  `src/tools/index.ts` → write `<name>.test.ts` (happy path + a scope-denied path) → `npm test`
  green. NEVER register a dangerous tool without a `riskTier` that forces the approval gate.
- **`harness-eval-runner`** — read `scripts/bench.mjs` for the runner contract → to add a suite,
  create `bench/<suite>/tasks.json` and `bench/<suite>/oracle.json` (committed ground truth, held
  -out tasks in a separate file) → grade only against the oracle, never a model self-report →
  `bun run bench` then `bun run verify-claims` to confirm the numbers re-derive.
- **`harness-refuter`** — load the finding + its provenance from the mission log → spawn a
  refuter (different model or temperature) prompted to DISPROVE the finding using only committed
  evidence → survives → confirmed; fails → retract, logging the refuter's reason → never report a
  finding as confirmed if it lacks provenance (`evidenceGate`) or was retracted.

## Phase 5 — Consumability

- **`CLAUDE.md`** at repo root — read automatically every Claude Code session; states the
  non-negotiable rules (§ this repo's root `CLAUDE.md`), layout, and commands.
- **Slash commands** (`.claude/commands/`) — e.g. `add-tool.md`: *"Add a new tool named
  `$ARGUMENTS` to the harness's ToolRegistry using the harness-tool-adder skill. Pick the correct
  riskTier, wire the safety gate, register it, and add tests."* Other examples:
  `/verify <finding-id>`, `/bench <suite>`, `/new-loadout <domain>`.
- **Subagents** (`.claude/agents/`) — e.g. `refuter.md`: role `skeptic`, tools restricted to
  `Read, Grep`, instructed to try to disprove a finding using only committed evidence, say
  `CONFIRMED` with specific evidence lines or `RETRACT` with the reason, never speculate beyond
  the committed evidence.
- **MCP exposure** — `src/mcp-server.ts`: exposes a safe subset of the harness over MCP (e.g. a
  `run_[objective]` tool that starts a scoped mission and returns status). Only non-dangerous,
  scope-gated capabilities are exposed; document the tool schema.

## Build order checklist (literal, for an agent to execute)

```
[ ] 0   project init, CLAUDE.md, directory contract
[ ] 1.1 llm backbone + fallback + tests
[ ] 1.2 config + redact + tests
[ ] 1.4 scope gate (pure) + tests        ← before any real tool
[ ] 1.5 tool registry + 2 inert tools + tests
[ ] 1.6 robust parser + tests
[ ] 1.7 mission (append-only) + tests
[ ] 1.3 ReAct loop wiring + end-to-end smoke on a trivial objective
[ ] 2.2 approval gate + fail-safe-deny + tests
[ ] 2.1 specialists + loadouts + tests
[ ] 2.3 evidence gate (provenance) + tests
[ ] 2.4 refuter + verify-finding + tests
[ ] 2.5 cli + lifecycle + tests
[ ] 2.6 verify-claims + pre-push hook
[ ] 2.7 doctor
[ ] 3.1 orchestrator (honest decomposition) + tests
[ ] 3.2 bench + oracles + anti-fitting guard
[ ] 3.3 requireHumanRelease checkpoint + test
[ ] 3.4 lessons record/retrieve + tests
[ ] 4   three SKILL.md capabilities
[ ] 5   CLAUDE.md, slash commands, subagents, MCP
[ ] ✔  npm test green · npm run verify-claims green · npm run doctor green
      (bun test · bun run verify-claims · bun run doctor, on this repo)
```
