# Operational Architecture — Components and Tier Goals

Source: *How to Build an Agent Meta-Harness* §2 (Component Inventory) and §4–6 (BASIC/INT/ADV).

## Component inventory (16 functional layers)

| # | Layer | Operational role | Representative tools / providers |
|---|-------|-------------------|-----------------------------------|
| 1 | LLM backbone / provider abstraction | One interface over many providers; text-mode tool-calling shim so non-function-calling models still work | OpenRouter, Anthropic, OpenAI, Venice, xAI + keyless local (Ollama, LM Studio, vLLM) |
| 2 | Agent loop (ReAct engine) | reason → act → observe, shared by every specialist | — |
| 3 | Arsenal / tool registry | Typed tool catalogue, each entry risk-tiered | 35 builtin / 83 with full arsenal in source |
| 4 | Approval + risk gating | Human-veto layer; gated tools inert until approved; fail-safe deny | — |
| 5 | Egress / scope containment | Refuses off-scope hosts by default (`SCOPE DENIED`), on by default | — |
| 6 | Orchestration (decomposition) | Master-builder splits an objective into sub-queries for worker models, synthesizes results | **use benign half only — see strategy.md boundary** |
| 7 | Operators / squad model | Role-scoped personas mapped to workflow phases | 8 operators in source, mapped to MITRE ATT&CK phases (domain-specific example) |
| 8 | Mission engine + control plane | Mission lifecycle, natural-language front door, HTTP API | CLI + optional HTTP server |
| 9 | Evidence vault + findings ledger | Append-only, provenance-tagged findings | — |
| 10 | Verification / refuter panel | Adversarial second-model check + claims re-derivation guard | — |
| 11 | Benchmark harness | Challenge suites graded against committed ground-truth oracles | XBEN, Cybench, CVE-Zero in source (domain-specific; generalize the *pattern*) |
| 12 | Coordinated output pipeline | Novelty/dedup check → artifact → refuter → scoring → human-sent draft | Source example is vuln disclosure; generalizes to any "human ships the final artifact" pipeline |
| 13 | Self-improvement loop | Records lessons/proposals per mission | Records only — retrieval into planning is roadmap |
| 14 | Prompt library / playbooks | Persona and playbook prompt packs | — |
| 15 | MCP + integration surface | Exposes a safe capability subset to other agents | MCP server exposing scope-gated tools |
| 16 | Stubs | Interface-only declarations for future modules, honestly marked as scaffolding | cloud, persistence, swarm, cognition (source examples) |

## Tier goals

**BASIC** — "one agent, one loop, one tool set, running safely and reproducibly." Delivers
layers 1–3 plus a Mission object (the seed of the control plane, layer 8).

**INT** — "multiple specialists, human-in-the-loop safety, and evidence you can trust."
Delivers layer 4 (approval gating), layer 6's parent concept as loadouts (layer 7,
generalized to specialist personas), layers 9–10 (evidence + refuter), layer 8 (full control
plane + CLI/API), and layer 15 (MCP exposure) plus a reproducibility guard.

**ADV** — "a harness that plans across models, measures itself, and improves." Delivers
layer 6 corrected to honest decomposition, layer 11 (benchmark harness), layer 12
generalized as a human-gated terminal-action pattern, layer 13 (lessons), and layer 16
(stubs for what's intentionally not built yet).

## Operational sequencing rationale

The scope gate (layer 5) is placed in BASIC, not INT, on a specific operational argument:
"a harness that can act before it can refuse is a liability." Safety floor precedes
capability at every tier boundary — this is why approval gating (layer 4, INT) still
composes through the scope gate (`check()` = `checkScope()` then `requestApproval()`) rather
than replacing it.
