---
title: "Trust Before Autonomy: Verification, Loadouts, and the Path Forward"
author: Sunyata
organization: Sensai Studio
series: THOR Meta-Harness
part: 3 of 3
date: 2026-07-09
---

# Trust Before Autonomy

Parts [1](./01-the-brain-and-the-discipline.md) and [2](./02-eight-planes-one-spine.md) established the axiom (model as brain, harness as discipline) and the eight-plane architecture. This final post is about what makes the system *trustworthy enough to extend* — and where THOR sits relative to the self-improving harness research Lilian Weng surveyed in July 2026.

The short version: we are building the verification and composition machinery first. Self-improvement is a recording mechanism today, not an autonomous optimizer. That boundary is deliberate.

## Loadouts: The Unit of Extension

A Loadout is how THOR instantiates a scoped research "individual" per project sub-folder. It bundles:

- **Specialist personas** — role, system prompt, tool allowlist
- **Tool subset** — only what the domain needs, each with a declared risk tier
- **Target adapter** — how scope is described and enforced for that domain
- **Benchmark suite** — `tasks.json` + committed `oracle.json`, graded without referencing specific test answers (anti-fitting guard)

Registering a second loadout for a different objective — with zero changes to the loop, gates, ledger, refuter, or control plane — is the proof that the harness is actually multi-purpose. Not a slide deck claim. A regression test.

```
Mission: "Summarize auth flow risks in /src/auth"
    │
    ├─ Loadout: codebase-research
    │     specialists: [reader, tracer]
    │     tools: [read_file, grep, record_finding]
    │     scope: file://./src/auth/**
    │
    └─ Spine (unchanged): scope → approval → execute → ledger → refuter → report
```

The operator's job is to declare scope and pick a loadout. The harness's job is everything else.

## The Refuter as Quality Engine

Among INT-tier components, the adversarial refuter is the highest-leverage quality mechanism in the repo.

The workflow:

1. Agent proposes a finding, backed by tool observations in the ledger.
2. Evidence gate checks provenance — reject if the citation chain is broken.
3. Refuter model receives *only* the committed evidence and is instructed to disprove the finding.
4. Outcome: confirmed (refuter failed) or retracted (refuter succeeded, reason logged).

This mirrors a pattern Weng's survey identifies across self-improving systems: **evaluation must be external to the agent that produced the claim**. When the harness itself becomes editable, provenance is not a nice-to-have — it is the difference between a system that compounds and a system that confabulates its own test logs.

We expose the refuter through three consumability surfaces:

- `bun run verify-finding` — CLI script for a single finding
- `/verify` slash command — operator workflow in Claude Code
- `refuter` subagent — Read/Grep only, tasked to disprove, never to confirm

Each path enforces the same rule: no provenance, no promotion.

## Reproduce Before Report

Research harnesses die by headline numbers that cannot be re-derived. THOR's answer is `verify-claims`: a script that re-computes every committed metric from artifacts in the repo, wired to a pre-push hook.

Benchmark suites under `bench/<suite>/` carry committed oracles. The grading logic must not reference specific test answers — the build fails if it does. Black-box and white-box results are reported separately and never blended.

Small-$n$ benchmarks are directional, not definitive. The harness is honest about that in its risk register. But "directional with receipts" beats "impressive without reproduction."

## Human Before Consequence

Full autonomy stops one step short of real-world effect.

`requireHumanRelease()` intercepts terminal actions: send, publish, delete, deploy, disclose. The harness produces a draft. A human executes. This is the strategic answer to "how autonomous should this get?" — autonomous through planning and evidence gathering, never through unsupervised consequence.

Combined with fail-safe deny on unattended approval gates, the posture is: **automate the investigation, never the irreversible action.**

## Self-Extension: Skills, Not Sprawl

Phase 4 makes the harness self-extending through three codified capabilities:

| Skill | What it does | Hard gate |
|-------|--------------|-----------|
| `harness-tool-adder` | Register a typed tool with correct risk tier and scope coverage | Tests green before done |
| `harness-eval-runner` | Create benchmark suites, run them, verify numbers re-derive | Anti-fitting guard passes |
| `harness-refuter` | Run adversarial verification on a finding | Never confirm without provenance |

These are accessible via slash commands (`/add-tool`, `/bench`, `/verify`, `/new-loadout`) and through an MCP server exposing a safe, scope-gated subset — no safety bypass, no dangerous tools over the wire.

This is harness engineering in Weng's sense: the runtime becomes an optimization surface, but **bounded**. The editable surfaces are explicit. The invariants are not among them.

## Connection to Self-Improving Harness Research

Weng organizes the RSI literature around a ladder of optimization targets:

$$\text{prompts} \rightarrow \text{context} \rightarrow \text{workflow} \rightarrow \text{harness code} \rightarrow \text{optimizer code}$$

And a three-stage loop for self-improving harnesses:

1. **Weakness mining** — cluster failures into patterns grounded by a verifier, using rich execution traces.
2. **Harness proposal** — a proposer suggests bounded edits within explicit editable surfaces.
3. **Proposal validation** — held-in regression (fix the weakness) + held-out regression (no new breakage); only then merge.

THOR is architected to *eventually* participate in that loop. Today:

- **Weakness mining** → partial. The lessons loop records structured takeaways per mission. Automatic clustering and feed-forward into planning is roadmap.
- **Harness proposal** → explicit via `harness-tool-adder` and loadout registration, not autonomous code rewrite.
- **Proposal validation** → strong. `bun test`, `verify-claims`, benchmark oracles, refuter gate.

We agree with Weng that harness optimization is the near-term path to compounding capability. We disagree with rushing to autonomous harness rewrite before provenance and adversarial verification are load-bearing. The DEV Community post on self-editing harnesses and faked test logs is not a hypothetical — it is the failure mode our invariants are designed against.

Sensai Studio's position: **earn the right to self-improve by proving you can refuse, record, refute, and reproduce first.**

## What THOR Is Not

Clarity requires boundaries:

- Not a prompt collection. Prompts are loadout configuration, not the product.
- Not a multi-agent swarm for its own sake. Orchestration is ADV-tier, experimental, honest-only.
- Not an offensive toolchain. Engineering patterns are extracted; exploitation payloads and prompt-injection catalogues are excluded.
- Not autonomous research publication. The harness investigates; humans decide what ships.

## The Factory Metaphor

The result is not a single agent. It is a factory for safe, reproducible agents — one per purpose, all sharing the same disciplined spine.

At Sensai Studio, we believe the next wave of research infrastructure will be judged the way we judge scientific instruments: not by eloquence, but by calibration. Can you trace the claim? Can an adversary break it? Can you run it again tomorrow and get the same number?

THOR is our instrument. The model supplies judgment. The harness supplies the discipline that makes judgment worth believing.

---

*Sunyata is Founder of [Sensai Studio](https://sensai.studio). This is Part 3 of a three-part series on the THOR meta-harness. Previous: [Eight Planes, One Spine](./02-eight-planes-one-spine.md). References: [Weng, 2026 — Harness Engineering for Self-Improvement](https://lilianweng.github.io/posts/2026-07-04-harness/).*
