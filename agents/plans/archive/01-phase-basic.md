# Plan 01 — Phase BASIC: The Minimum Viable Harness

Goal: one agent, one loop, one tool set, running safely and reproducibly. Nothing in this
phase is domain-specific — it is the fixed spine every future purpose runs on.

Dependencies: none (first phase). Blocks everything else — no INT or ADV task may start
before this phase's DoD is met.

## Tasks

### 1.0 Project init
- [ ] `bun init`, `bun add eventemitter3 zod`, `bun add -d typescript tsx @types/node eslint`
- [ ] `npx tsc --init` (strict mode on)
- [ ] Create the `src/` directory contract: `llm/ config/ agent/ safety/ tools/ parse/ mission/`

### 1.1 Provider abstraction — `src/llm/index.ts`
- [ ] `LLMBackbone` class, single `complete()` method normalizing chat/streaming/token
      budgets across providers
- [ ] Config shape `{ provider, model, apiKey?, baseUrl?, maxTokens, temperature }`;
      `Provider = 'anthropic' | 'openai' | 'openrouter' | 'local'`
- [ ] Text-mode tool-calling shim: serialize tool schemas into the system prompt and parse
      tool calls back out, for models without native function-calling
- [ ] Retry with exponential backoff; a `fallback` list of configs tried in order
- [ ] Never log secrets; return `{ text, toolCalls[], usage }`
- [ ] `src/llm/index.test.ts` against a fake transport — no real network calls in tests

### 1.2 Config + key management — `src/config/index.ts`
- [ ] Typed config loaded from env + optional `~/.harness/config.json`
- [ ] `defaultProvider`, `AVAILABLE_MODELS` registry, env-var key resolution (no hardcoded
      keys anywhere)
- [ ] `loadConfig()` and a `redact()` helper that masks secrets in any object before it is
      logged
- [ ] Tests covering redact() against nested objects containing key-shaped strings

### 1.4 Scope gate — `src/safety/scope.ts`
- [ ] Pure function `checkScope(call, mission)` — no I/O in this module
- [ ] For any tool touching network, filesystem writes, or shell: allow ONLY if the target
      is inside the mission's declared scope
- [ ] Deny off-scope hosts/paths, loopback, and private ranges **by default**
- [ ] Denial reason string format: `"SCOPE DENIED: <detail>"`
- [ ] Exhaustive tests including edge cases (IPv6 loopback, private CIDR ranges, path
      traversal, mixed-case hostnames)
- [ ] **Must exist and be tested before task 1.5 registers any tool with real side effects**

### 1.5 Typed tool registry — `src/tools/registry.ts`
- [ ] `Tool<I> = { name, description, inputSchema: z.ZodType<I>, riskTier:
      'safe'|'active'|'intrusive'|'credential'|'dangerous', run(input): Promise<string> }`
- [ ] `register(tool)`, `schemas()` (serialized for the model), `execute(toolCall)` —
      validates input against the zod schema THEN runs
- [ ] Ship exactly 2–3 inert `safe`-tier starter tools (e.g. `read_file`, scope-checked
      `http_get`, `list_dir`) — no dangerous tools in this phase
- [ ] Tests for schema validation rejection and successful execution paths

### 1.6 Robust output parsing — `src/parse/json.ts`
- [ ] `parseLastObject(text)` and `parseLastArray(text)`: strip code fences, try a direct
      parse, then scan every balanced `{…}`/`[…]` span and return the LAST one that parses
      to the expected shape
- [ ] Never call `JSON.parse` directly on raw model output anywhere else in the codebase
- [ ] Tests with fenced JSON, trailing prose, and stray-brace inputs

### 1.7 Mission object — `src/mission/index.ts`
- [ ] Holds `id`, `objective`, `scope` (allowed hosts/paths), `status`, an append-only
      `transcript`, and a `findings` array
- [ ] Methods: `record()` (immutable append), `transcript()` (formatted for the model),
      `addFinding()`, `snapshot()` (serializable)
- [ ] Tests asserting transcript and findings entries are never mutated after write

### 1.3 The ReAct agent loop — `src/agent/index.ts`
- [ ] `Agent` class: inputs `LLMBackbone`, `ToolRegistry`, system prompt, a `Mission`,
      `maxSteps`
- [ ] Each step: ask model for next action → if a tool call, run it THROUGH the safety
      gate (stub is fine until 2.2 lands; must at minimum call `checkScope`) → feed
      observation back → repeat
- [ ] Stop on an explicit final answer OR when `maxSteps` is hit (hard, non-negotiable
      ceiling — no override path)
- [ ] Emit typed events (`step`, `toolCall`, `observation`, `done`, `error`) via
      `eventemitter3` so a CLI/UI can subscribe later
- [ ] Every tool result and model turn is written to the Mission's append-only log
- [ ] `src/agent/index.test.ts` driving a fake LLM through a scripted 3-step run

## Definition of done

- [ ] `bun test` green across all modules above
- [ ] A single agent runs end-to-end against a trivial objective (e.g. "read this file and
      summarize it") using only `safe`-tier tools, and the full transcript is recoverable
      from the Mission object afterward
- [ ] Scope gate denial is exercised and verified in at least one end-to-end test (attempt
      an off-scope `http_get`, confirm `SCOPE DENIED` and no network call occurs)
- [ ] No dangerous/credential/intrusive-tier tools exist anywhere in the tree yet — those
      are gated by design starting in Phase INT (see `02-phase-int.md`)
