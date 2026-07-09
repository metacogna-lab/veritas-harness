# Strategy — What We're Building, and Why

Source: *How to Build an Agent Meta-Harness* (Meta-Harness Engineering Guide / T3MP3ST
How-to-Harness Report — two copies of the same analysis) + *Building an Agent Harness with
Claude Code*.

## Definitions

- **Harness** — the deterministic scaffold around a non-deterministic model: the loop, the
  tools, the parsing, the memory, the guardrails. The model supplies judgment; the harness
  supplies structure, safety, and reproducibility.
- **Meta-harness** — a harness that *builds and coordinates other harnesses*. Instead of one
  agent in one loop, it composes **loadouts** (specialist personas + a tool set + a target
  adapter + a scoring benchmark) against a shared control plane. New capability domains
  compose as a new loadout — they never fork the codebase.

## Why a strict tier order (BASIC → INT → ADV)

The build is bottom-up by design: every INT element assumes the BASIC spine exists; every
ADV element assumes INT. This is a strategic constraint, not an outline convenience — adding
sophistication (multi-model orchestration, self-benchmarking) on top of a harness that has no
scope gate or approval gate increases capability without increasing safety, which is the
failure mode the whole design exists to prevent.

## The 13-point strategic blueprint (domain-independent)

1. Abstract the model (provider + local, text-mode tools). `[BASIC]`
2. A dumb loop, a typed tool registry, robust parsing. `[BASIC]`
3. Scope + safety gate before any side-effecting tool. `[BASIC]`
4. Specialist loadouts that compose, not fork. `[INT]`
5. Risk-tiered approval with fail-safe-deny. `[INT]`
6. Append-only evidence + provenance gating. `[INT]`
7. A second-model refuter between claim and truth. `[INT]`
8. A control plane with a natural-language front door + API/MCP. `[INT]`
9. A reproducibility guard that re-derives every claim on CI. `[INT]`
10. An orchestrator that decomposes across models — benign half only. `[ADV]`
11. Self-benchmarking against committed oracles with an anti-fitting guard. `[ADV]`
12. Human-gated terminal step on anything consequential. `[ADV]`
13. A recorded lessons loop, closing toward planning feedback. `[ADV]`

## How this maps onto Veritas's mandate

Per `agents/config/agents-config.md`: build a general-purpose research meta-harness that
initializes/configures a scoped "individual" harness per project sub-folder. Loadout
composition (item 4) is the load-bearing mechanism — each sub-folder project becomes a new
Loadout (tools + specialists + target adapter), never a new codebase.

## Explicit strategic boundary (what is deliberately excluded)

The source material analyzes T3MP3ST, an offensive-security framework, purely as an
engineering artifact. Two things are adopted as *pattern only*, never as content:

- **Decomposition orchestrator** — keep the parallel-worker/synthesize pattern (parallelism,
  token budgeting, context packing). Discard the source's "context isolation from a
  safety-trained worker model" design: that is a liability under any hosted-model provider's
  terms, not a feature, and is exactly the behavior providers detect and block.
- **AI red-team technique catalogue** (~18 prompt-injection/jailbreak families in the
  source) — used only as a list of attacks this harness's own defenses must resist; never
  reproduced operationally.

## Honest trade-offs the source material concedes

- An 8-operator swarm concept is largely unproven upstream — headline numbers came from a
  single-agent ReAct loop, not a coordinated cell.
- Self-improvement records lessons but retrieval-into-planning is roadmap, not delivered.
- Small-n benchmark results are directional, not definitive.
- BASIC + INT alone already yields "a genuinely useful, safe, auditable agent harness." ADV
  is explicitly where the research risk (and the most honest self-critique) lives.

## The through-line

"The model is the brain; the harness is discipline." Reproducibility, provenance,
adversarial verification, and hard safety gates are what separate a meta-harness from a
prompt with delusions of grandeur.
