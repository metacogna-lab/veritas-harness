# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mission

Act as a senior software engineer specializing in harness engineering. Build a general-purpose
research meta-harness: a tiered agent harness (BASIC → INT → ADV) that can be instantiated as a
scoped "individual" per project sub-folder. The model supplies judgment; the harness supplies
structure, safety, and reproducibility — never the reverse.

This repo implements the Veritas research meta-harness under **`harness/veritas-research/`**
(canonical build target). Read `agents/config/agents-config.md` at the start of any session
touching this repo — it is the operating mandate, not background reading. Session state and
remaining work: `agents/state/state-2026-07-09T1716.md`, build log: `agents/state/build-log.md`.

**Provenance note:** the reference docs in `agents/docs/` analyze `elder-plinius/T3MP3ST`, an
offensive-security multi-agent framework, purely as an engineering artifact. The docs already
flag and exclude two things: exploitation payloads/chains, and an AI red-team prompt-injection
technique catalogue. Do not go looking for either in the source repo or reproduce them here. The
one pattern from that source explicitly marked an anti-pattern — a decomposition orchestrator
designed to hide an objective's true shape from a worker model to route around its safety
training — must never be built. §"Non-negotiable safety invariants" below, point 7.

## Commands

All commands run from **`harness/veritas-research/`** (per global mandate, `npm` in source docs is `bun`):

```
cd harness/veritas-research
bun install                    # install deps
bun run dev                    # tsx src/cli.ts — run the harness CLI
bun run build                  # tsc
bun test                       # run the test suite (co-located *.test.ts per module)
bun test src/safety/scope.test.ts   # run a single test file
bun run doctor                 # scripts/doctor.mjs — env/provider/PATH healthcheck
bun run verify-claims          # scripts/verify-claims.mjs — re-derive every headline number
                               # from committed artifacts; pre-push hook at .githooks/pre-push
bun run verify-finding         # scripts/verify-finding.mjs — run the refuter against a finding
bun run bench                  # scripts/bench.mjs — run committed-oracle benchmark suites
bun run lessons                # scripts/lessons.mjs — record/retrieve mission lessons
bun run ingest --input ingest/NEW.md   # compile research brief → research-plan.json
bun run dev start --plan missions/<slug>/research-plan.json   # start from ingested plan
bun run veritas-config             # interactive local.json wizard (terminal)
```

Slash commands: `/ingest`, `/provider`, `/veritas-config` (see `skills/` and `.claude/commands/`).

The Claude Code CLI itself (the agent this harness is built with/for) is a global tool, installed
separately: `npm install -g @anthropic-ai/claude-code` (Node 18+; this one stays npm since it's
not this project's dependency tree).

### Model / provider selection

Config lives in **`harness/veritas-research/src/config/`** (`default.json` + optional gitignored
`local.json`). Default provider is **Anthropic (Claude API)** — not Ollama. See **`PROVIDER.md`**
for operator guide; use `/provider [name]` for model catalog info.

```bash
# One-off provider switch
HARNESS_PROVIDER=ollama HARNESS_MODEL=qwen3-coder:latest bun run dev start ...
HARNESS_PROVIDER=claude-code bun run ingest --input ingest/NEW.md
HARNESS_PROVIDER=codex bun run dev start ...

# One-off model switch (keeps default provider)
HARNESS_MODEL=claude-opus-4-8 bun run dev start "objective" --target .

# Persistent overrides
cp src/config/local.example.json src/config/local.json
# or: bun run veritas-config
```

Set `ANTHROPIC_API_KEY` for the default provider. See `PROVIDER.md` and `src/config/README.md`.

## What is being built

A single `Agent` class running a ReAct loop (system prompt → propose action → execute tool
through a safety gate → observe → repeat → stop/answer), wrapped in a control plane (a `Mission`
object: objective, scope, append-only transcript, findings). New capability domains are added as
**Loadouts** (specialist persona + tool subset + target adapter + benchmark) that compose against
the same loop — never as a fork of the loop itself. That composition property is what makes it a
*meta*-harness: reuse the loop/gates/ledger/refuter/verifier/orchestrator/control-plane unchanged,
and only swap the objective-specific tools, specialists, and target adapter.

## Build order (bottom-up; do not skip or reorder — each phase assumes the previous is done)

**Phase 1 — BASIC** (one agent, one loop, one tool set, safe and reproducible)
1.1 provider abstraction (`src/llm/` — `LLMBackbone.complete()`, provider+local fallback chain,
text-mode tool-calling shim for non-function-calling models) → 1.2 config + key management
(`src/config/`, env-var resolution, `redact()` before any logging) → 1.4 scope gate
(`src/safety/scope.ts` — pure predicate, `checkScope()`, deny off-scope/loopback/private by
default with `SCOPE DENIED: <detail>`; **this must exist before any real tool is wired in**) →
1.5 typed tool registry (`src/tools/` — `{ name, description, inputSchema (zod), riskTier, run() }`,
ship only inert `safe`-tier starter tools first) → 1.6 robust output parsing (`src/parse/` —
strip fences, scan balanced bracket spans, take the last one that parses; never a naive
`JSON.parse` on model output) → 1.7 the Mission object (`src/mission/` — append-only transcript
and findings, nothing is ever mutated after write) → 1.3 wire the ReAct loop (`src/agent/`) and
smoke-test it end-to-end against a trivial objective before proceeding.

**Phase 2 — INT** (specialists, human-in-the-loop, evidence you can trust)
2.1 specialist loadouts (`src/agent/specialists.ts` — role, system prompt, tool-allowlist; a
`Loadout` groups specialists + tool subset + target adapter + benchmark) → 2.2 approval gate +
risk-tier gating (`src/safety/approval.ts` — `intrusive`/`credential`/`dangerous` tiers inert
until approved, approve-once-then-free per session, `dangerous`/`credential` fire an audited
warning on *every* call even after approval, fail-safe deny when unattended with no approver
wired; compose as `src/safety/index.ts check()` = `checkScope` then `requestApproval`) →
2.3 evidence ledger + provenance gate (`src/evidence/gate.ts` — reject any finding not backed by
a real tool observation in the mission log) → 2.4 adversarial verification / refuter
(`scripts/verify-finding.mjs`, `src/evidence/refuter.ts` — a separate model instance/temperature
tries to disprove a finding using only committed evidence; survives → confirmed, fails →
retracted with the refuter's reason logged) → 2.5 control plane (`src/cli.ts`, optional
`src/server.ts` — CLI verbs `start "<objective>" --scope <...>`, `status <id>`, `report <id>`) →
2.6 reproducibility guard (`scripts/verify-claims.mjs`, git pre-push hook — a claim that can't be
reproduced doesn't ship) → 2.7 healthcheck (`scripts/doctor.mjs`).

**Phase 3 — ADV** (orchestration, benchmarking, self-improvement)
3.1 multi-model decomposition orchestrator (`src/orchestration/` — parallelism, token budgeting,
context packing, round-based synthesis; **honest decomposition only**, see invariant 7) →
3.2 benchmark harness with committed ground-truth oracles per task, anti-fitting guard (fail the
build if grading logic references specific test answers), black-box/white-box results reported
separately and never blended → 3.3 `requireHumanRelease(action)` checkpoint on any consequential
terminal action (send/publish/delete/deploy/disclose) — the harness stops one step short and a
human executes → 3.4 lessons loop (`scripts/lessons.mjs`, `src/resources/lessons.ts` — record
structured lessons per mission; feeding them back into planning is roadmap, not required day one,
mark this clearly).

**Phase 4 — Skills** (make the harness self-extending): three `SKILL.md` capabilities under
`skills/` — `harness-tool-adder`, `harness-eval-runner`, `harness-refuter`. Trigger-rich
descriptions, imperative verifiable steps, end each with a hard "don't mark done until tests are
green" gate.

**Phase 5 — Consumability**: this file, `.claude/commands/` slash commands (e.g. `/add-tool`,
`/verify`, `/bench`, `/new-loadout`), `.claude/agents/` subagents (e.g. a `refuter` subagent that
only has Read/Grep and is instructed to try to disprove a finding), `src/mcp-server.ts` exposing
a safe, non-dangerous, scope-gated subset of the harness over MCP.

## Non-negotiable safety invariants (bake into code, tests, and CI — never bypassed)

1. **Scope before action.** No side-effecting tool (network, filesystem write, shell) runs
   outside the mission's declared scope. (1.4)
2. **Fail-safe deny.** A gated tool with no approver wired, unattended, is denied — never
   silently fired. (2.2)
3. **Provenance before claim.** No finding is accepted without a real tool observation behind it
   in the mission log. (2.3)
4. **Refute before confirm.** A second model instance must fail to disprove a finding before it
   is promoted to confirmed. (2.4)
5. **Human before consequence.** Terminal actions with real-world effect stop one step short and
   require explicit human release. (3.3)
6. **Reproduce before report.** Every headline number re-derives from committed artifacts via
   `bun run verify-claims`. (2.6, 3.2)
7. **Honest decomposition.** Orchestrator workers get a truthful description of their subtask.
   Never build context-isolation designed to hide the objective's shape from a worker model to
   route around its safety behavior — that is the one pattern from the source material that is
   explicitly an anti-pattern, not a build step. (3.1)
8. **Compose, don't fork.** New capability domains are a new Loadout/Tool registration, never a
   copy of the agent loop. (2.1)

## Directory contract (canonical layout: `harness/veritas-research/`)

```
harness/veritas-research/
  src/llm/            provider abstraction (LLMBackbone, provider + local fallback chain)
  src/config/         typed config, env-var key resolution, redact()
  src/agent/          the ReAct loop + specialists.ts (loadouts)
  src/safety/         scope.ts + approval.ts + human-release.ts, composed as index.ts check()
  src/tools/          typed ToolRegistry (name, zod inputSchema, riskTier, run())
  src/parse/          robust JSON extraction from model output
  src/mission/        the Mission object — append-only transcript + findings
  src/evidence/       provenance gate + refuter
  src/orchestration/  ADV-tier decomposition orchestrator (honest decomposition only)
  src/resources/      lessons.ts, research-plan.ts
  src/ingest/         sanitize, parse, catalog, fit, validate pipeline
  src/mcp-server.ts   safe scope-gated MCP subset (no safety bypass)
  scripts/            verify-claims.mjs, verify-finding.mjs, bench.mjs, doctor.mjs, lessons.mjs, veritas-config.mjs
  skills/             harness-tool-adder/, harness-eval-runner/, harness-refuter/, harness-ingest/, harness-provider/, harness-veritas-config/
  .claude/            commands/, agents/
  bench/<suite>/      tasks.json + committed oracle.json per suite
  resources/          lessons.json (committed lesson store)
  ingest/             NEW.md (gitignored), TEMP.md, examples/
  missions/<slug>/    ingested research-plan.json per research brief
  PROVIDER.md         operator guide for provider/model selection
```

Above `harness/`, this repo's own `agents/` tree is the meta-harness's operating workspace, not
harness source code:

```
agents/config/agents-config.md   the operating mandate — re-read every session
agents/docs/                     source reports this build plan is derived from
agents/docs/downloads/           pulled research papers land here (currently empty)
agents/plans/ state/             build plans and session state
agents/errors/ evals/            eval records for delivered harness work
```

## Adapting to a new objective

Only three things change per project/domain: `src/tools/` (capabilities the objective needs),
`src/agent/specialists.ts` (roles and prompts), and the target adapter (how a mission's scope is
described). Everything else — loop, gates, ledger, refuter, verifier, orchestrator, control
plane — is reused unchanged. That reuse is the meta-harness.
