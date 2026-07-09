---
title: "Eight Planes, One Spine: The Architecture of THOR"
author: Sunyata
organization: Sensai Studio
series: THOR Meta-Harness
part: 2 of 3
date: 2026-07-09
---

# Eight Planes, One Spine

In [Part 1](./01-the-brain-and-the-discipline.md), we argued that a meta-harness reuses one disciplined spine across domains while swapping loadouts — never forking the loop. This post is the architectural map of that spine.

The dominant failure mode in agent framework design is **concern mixing**: safety logic embedded in tools, provenance checks sprinkled through prompts, orchestration code that secretly rewrites scope. THOR decomposes the runtime into **eight orthogonal planes** with narrow interfaces, built bottom-up so no layer depends on a capability that does not yet exist.

Think of it less as a microservices diagram and more as an operating system for agents — each plane encapsulates complexity the layers above should not need to understand.

```
┌─────────────────────────────────────────────────────────────┐
│  Control Plane     Mission lifecycle, intake, cost, report  │
├─────────────────────────────────────────────────────────────┤
│  Orchestration     Honest decomposition, parallel workers   │
├─────────────────────────────────────────────────────────────┤
│  Execution         ReAct loop — deliberately dumb           │
├─────────────────────────────────────────────────────────────┤
│  Capability        Typed tool registry (schema + risk tier) │
├─────────────────────────────────────────────────────────────┤
│  Memory            Evidence ledger ⟂ ephemeral context      │
├─────────────────────────────────────────────────────────────┤
│  Verification      Provenance gate + adversarial refuter     │
├─────────────────────────────────────────────────────────────┤
│  Safety            Scope gate → approval gate (fail-safe)   │
├─────────────────────────────────────────────────────────────┤
│  Provider          LLM abstraction, fallback, cost accounting │
└─────────────────────────────────────────────────────────────┘
```

## Provider Plane

At the bottom, a single `complete()` interface normalizes chat, streaming, and token budgets across Anthropic, OpenAI, OpenRouter, and local runtimes (Ollama, LM Studio, vLLM). Retry with exponential backoff, configurable fallback chains, and per-mission cost accounting live here — not in the agent loop.

A text-mode tool-calling shim lets non-function-calling local models participate. This is pragmatic harness engineering: the loop should not care which provider won the call.

## Safety Plane

Safety is a **pure, I/O-free predicate layer**. Every side-effecting tool routes through it before execution. Two gates, always in this order:

1. **Scope gate** (`checkScope`). Deny any target outside the mission's declared scope. Off-scope hosts, loopback, and private ranges are rejected by default with an explicit `SCOPE DENIED` response.
2. **Approval gate** (risk-tier gating). Tools tagged `intrusive`, `credential`, or `dangerous` remain inert until a human approves. After approval, `dangerous` and `credential` tiers still emit an audited warning on every call.

The fail-safe rule: an unattended run with no approver wired **denies** every gated tool. Silent execution is a bug, not a feature.

Weng's survey emphasizes permission controls as first-class harness design. We treat them as preconditions, not polish.

## Verification Plane

This is the plane that separates a demo from a system.

The **evidence gate** rejects any finding that cannot point to a real tool observation in the mission log. No observation, no claim — the antidote to model confabulation.

The **adversarial refuter** spins up a separate model instance (different model or temperature) and tasks it with *disproving* the finding using only committed evidence. If the refuter succeeds, the finding is retracted and the reason is logged. If it fails, the finding is promoted to confirmed.

This is not optional QA. It is the harness's primary quality mechanism — a direct response to the provenance problem that emerges when agents can edit their own scaffolding (as Weng's RSI literature documents in systems like Darwin Gödel Machine and Self-Harness). An agent that can fake a test log must face an adversary that reads the same ledger.

## Memory Plane

Two concepts, strictly separated:

- **Evidence ledger** — append-only, provenance-tagged, immutable after write. Every tool call and observation. The only legitimate source for findings.
- **Ephemeral context** — rolling summaries and scratchpads fed to the model on each ReAct step. Windowed, discardable, never authoritative.

Weng's "file system as persistent memory" pattern applies to artifacts and logs. The ledger is narrower: it is the *audit trail*, not the model's working notes.

## Capability Plane

A typed tool registry. Every tool carries a name, description, Zod input schema, and risk tier. Validation happens at the boundary — before `run()` is invoked. The tool itself is a pure function from validated input to string observation.

Ship `safe`-tier starter tools first. Dangerous capability does not exist in the tree until INT-tier approval gating is proven.

## Execution Plane

The ReAct loop is intentionally boring:

> reason → propose action → execute through safety gate → observe → repeat → stop

Hard step ceilings are non-negotiable. The loop emits typed events (`step`, `toolCall`, `observation`, `done`, `error`) so any CLI, UI, or API can subscribe. It has no domain knowledge, no special cases, no exceptions. It is the fixed spine.

## Orchestration Plane (ADV)

A master builder decomposes large objectives into independent sub-queries, dispatches them in parallel to worker models with bounded concurrency, and synthesizes results over rounds with accumulated knowledge.

**Honest decomposition only.** Every worker receives a truthful, complete subtask description. Context-isolation designed to hide an objective's shape from a worker model is explicitly forbidden — invariant #7, tested, not documented.

Orchestration here is workload engineering: parallelism, cost optimization, context budgeting. Not safeguard evasion.

## Control Plane

The top layer owns the `Mission` object: objective, scope, lifecycle (`pending → running → verifying → done/error`), append-only transcript, cost aggregation, and findings that survived the evidence gate and refuter.

Natural-language intake resolves a plain-English objective into a Mission + Loadout. The control plane is where operators start missions, check status, and pull reproducible reports.

## The Eight Invariants

These are not guidelines. They are CI failures waiting to happen:

| # | Invariant | Plane |
|---|-----------|-------|
| 1 | Scope before action | Safety |
| 2 | Fail-safe deny | Safety |
| 3 | Provenance before claim | Verification |
| 4 | Refute before confirm | Verification |
| 5 | Human before consequence | Safety + Control |
| 6 | Reproduce before report | Verification |
| 7 | Honest decomposition | Orchestration |
| 8 | Compose, don't fork | All |

If a task would require violating one of these, the task must be reconsidered — not the invariant.

## Tiered Build as Architectural Strategy

The eight planes are not built simultaneously. The tier structure is a **trust precondition chain**:

**BASIC** delivers provider abstraction, config with `redact()` before logging, scope gate, tool registry, robust JSON parsing (scan balanced bracket spans — never naive `JSON.parse` on model output), mission object, and a smoke-tested ReAct loop. One agent, one loop, safe in isolation.

**INT** adds loadouts, approval gating, the evidence ledger, the refuter, CLI/HTTP control plane, and `verify-claims` wired to a pre-push hook. Any headline number that cannot be re-derived from committed artifacts does not ship.

**ADV** adds honest orchestration, benchmark harnesses with committed oracles and anti-fitting guards, `requireHumanRelease()` on terminal actions (send, publish, delete, deploy, disclose), and a lessons loop that records structured takeaways — with automatic feedback into planning explicitly marked as roadmap.

Do not begin ADV until INT's evidence and reproducibility gates are green. Multi-agent coordination is genuinely experimental; the source material's strongest results came from a single-agent loop.

## Why Planes Matter

Orthogonal planes keep the meta-harness property honest. When a new research domain arrives as a project sub-folder, you register a loadout — not a fork. The planes you do not touch are the proof that composition works.

In [Part 3](./03-trust-before-autonomy.md), we close the loop: how loadouts compose in practice, how the harness extends itself through skills, and how THOR connects to the self-improving harness research Weng surveys — with Sensai Studio's conservative stance on what "self-improvement" means today.

---

*Sunyata is Founder of [Sensai Studio](https://sensai.studio). This is Part 2 of a three-part series on the THOR meta-harness. Previous: [The Brain and the Discipline](./01-the-brain-and-the-discipline.md). Next: [Trust Before Autonomy](./03-trust-before-autonomy.md).*
