# Build Log — Veritas Research Meta-Harness

Location: `harness/veritas-research/`. Read this at the start of every session before
re-deriving decisions.

## Standing decisions (apply across phases)

- **Package manager:** bun (global mandate). Every `npm` in source docs is `bun` here.
- **Build target dir:** `harness/veritas-research/` (per user instruction), with the plan's
  `src/ scripts/ skills/ .claude/ bench/` layout underneath it.
- **Test layout:** co-located `*.test.ts` per module, run with `bun test`.
- **Immutability:** all Mission transcript/findings are append-only; never mutate after write.

---

## Phase BASIC — COMPLETE ✅ (verified: `bun test` 87 pass / 0 fail, `tsc --noEmit` exit 0)

Built (dependency order): parse → config → llm → scope → mission → tools → agent.

- **1.6 parse** (`src/parse/json.ts`): `parseLastObject`/`parseLastArray`. Strips fences,
  scans TOP-LEVEL balanced spans (not nested), returns last that parses. String/escape aware.
- **1.2 config** (`src/config/`): `loadConfig()` (env + `~/.harness/config.json`, injectable
  env for tests), `AVAILABLE_MODELS`, `redact()` (key-name + value-shape detectors, cycle-safe,
  non-mutating).
- **1.1 llm** (`src/llm/`): `LLMBackbone.complete()` with retry+backoff, fallback chain,
  text-mode tool-calling shim (`shim.ts`) for non-native models, injectable transport (tests use
  a fake — no real network). Real fetch transports in `transports.ts` (anthropic + openai-compat).
- **1.4 scope** (`src/safety/scope.ts`): pure `checkScope(call, scope)`. Owns `MissionScope`/
  `ScopeTarget` types. Denies off-scope/loopback/private/traversal by default; `SCOPE DENIED:` prefix.
- **1.7 mission** (`src/mission/`): append-only, deep-frozen entries; `record`/`addFinding`/
  `updateFindingStatus`/`snapshot`. `Finding` carries provenance. Injectable `findingValidator`
  seam is the hook INT 2.3's evidence gate plugs into (default accept-all).
- **1.5 tools** (`src/tools/`): `ToolRegistry` (zod schemas, `riskTier`, `scopeTargets`,
  `execute()` = validate → injected safety check → run, all failures returned as observations).
  Starter tools: `read_file`, `list_dir`, `http_get`.
- **1.3 agent** (`src/agent/`): `Agent` ReAct loop, typed `eventemitter3` events, hard `maxSteps`
  ceiling, injectable `safetyCheck` (default scope-only; INT swaps in composed check).

### Judgment calls
- **Starter tools tiered `active`, not the plan's literal `safe`.** They do real (read-only) I/O.
  The tool-adder skill's own rule is "side effects ⇒ at least active". Gating is identical
  (neither `safe` nor `active` is in GATED_TIERS), scope gate still applies. A registry test
  asserts no starter tool exceeds `active` (BASIC DoD: no intrusive/credential/dangerous tools).
- **`build` = `tsc --noEmit`** (typecheck only). Bun runs `.ts` directly; no emit step needed.
- **Scope gate scope-checks fs-READ too** (not just writes) — reads are info disclosure; conservative.
- **Deferred:** real provider transports exist but are unexercised by tests (no network in CI).
  Doctor (2.7) will check provider reachability at runtime instead.

## Phase INT — COMPLETE ✅ (verified: `bun test` 128 pass / 0 fail, `tsc` exit 0, `doctor` + `verify-claims` exit 0)

- **2.1 specialists/loadouts** (`src/agent/specialists.ts`, `loadouts.ts`): `Specialist`,
  `Loadout`, `TargetAdapter`, `LoadoutRegistry`. Two example loadouts (`codebase-audit`,
  `web-recon`) share one loop. `Agent` refactored to accept a `specialist` (uses its prompt +
  subsets registry to its allowlist) — loop body unchanged (invariant #8).
- **2.2 approval** (`src/safety/approval.ts` + `index.ts`): GATED {intrusive,credential,dangerous},
  SPICY {credential,dangerous} warn every call. Interactive + pre-authorized paths, approve-once,
  fail-safe deny. `createSafetyCheck()` composes scope→approval (scope always first). Wired into
  the loop via the Agent's `safetyCheck` seam — no loop change.
- **2.3 evidence gate** (`src/evidence/gate.ts`): `evidenceGate` FindingValidator; rejects findings
  with no matching successful observation. Plugged into Mission via the BASIC `findingValidator` seam.
- **2.4 refuter** (`src/evidence/refuter.ts` + `scripts/verify-finding.mjs`): separate LLM disproves
  using only committed evidence; unparseable verdict → retracted (fail-safe). `promoteFinding` records
  outcome. `verify-finding --fixture` runs offline against the committed artifact.
- **2.5 control plane** (`src/control/plane.ts`, `store.ts`, `src/cli.ts`): NL front door →
  Mission+Loadout, runs agent, persists snapshot. Verbs start/status/report/loadouts. Findings enter
  via a mission-bound `record_finding` tool (`src/tools/record-finding.ts`, safe tier) that routes
  through the evidence gate. Optional `refuterLLM` promotes findings post-run.
- **2.6 verify-claims** (`scripts/verify-claims.mjs` + `scripts/lib/stats.mjs`): re-derives headline
  numbers from committed `claims.json` (kinds: findings_count, bench_pass_at_1 with Wilson-95).
  Pre-push hook at `.githooks/pre-push`.
- **2.7 doctor** (`scripts/doctor.mjs`): Bun/Node/config/redaction/provider-key/PATH checks.

### Judgment calls
- **`record_finding` tool added as the finding-creation path.** The plans specify the evidence gate
  but not HOW the agent emits findings; a functioning e2e (INT DoD) needs one. Built it as a
  mission-bound safe-tier tool so findings route through `addFinding`→evidence gate and the loop is
  unchanged. Added to both loadouts' tool lists.
- **Golden artifact for reproducibility:** `scripts/gen-int-smoke.mjs` runs the full spine
  deterministically and writes committed `bench/int-smoke/mission.json` + `claims.json`. Re-run it
  when the spine changes. `verify-claims` re-derives "1 confirmed finding" from it.
- **Pre-push hook NOT auto-enabled.** `harness/veritas-research` is a subdir of the `veritas` git
  repo; setting `core.hooksPath` would affect the whole repo. Left the hook file in place; enable with
  `git config core.hooksPath harness/veritas-research/.githooks` (or copy into `.git/hooks`).
- **HTTP server (2.5 optional) deferred** — CLI covers the control-plane DoD; note in risk register
  open-Q about API auth remains for if/when it's built.

---

## Consolidation (2026-07-09)

Work was split across `harness/general-purpose/` (INT scripts, orchestrator, int-smoke) and
`harness/veritas-research/` (bench harness, scope-gate suite). User confirmed canonical path is
`harness/veritas-research/`. Unit 1 merges general-purpose artifacts in and removes the duplicate
tree. See `agents/state/state-2026-07-09T1716.md` for remaining work units.
