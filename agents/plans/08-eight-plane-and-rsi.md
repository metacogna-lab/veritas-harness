# Plan 08 — Eight-plane architecture + self-improving harness (RSI)

Derived from `agents/docs/eight-plane-harness-architecture-doc.md` and recent
harness-engineering research on self-improvement. This plan formalizes the plane
boundaries the harness already embodies and lays out a **phased, human-gated** path
to a self-improving harness. It does not authorize autonomous self-modification —
that stays behind human release (invariant #5).

## 1. The eight planes (decoupled, narrow interfaces)

Mixing these concerns is the primary cause of unmaintainable agent frameworks. The
binding source of truth for the module→plane mapping is
`harness/veritas-research/src/planes.ts`, asserted by `src/planes.test.ts` (every
mapped module must exist, so the map cannot silently drift). The template harness
carries the same map at `meta/templates/harness-template/src/planes.ts`.

| Plane | Module(s) | Narrow interface | Responsibility |
|-------|-----------|------------------|----------------|
| Provider (bottom) | `src/llm/` | `LLMBackbone.complete()` | Hide provider quirks; fallback chain; token/cost accounting; text-mode tool shim |
| Safety | `src/safety/` | `check(scopeCall, tool) → decision` | Pure, I/O-free gates: scope containment, risk tiers, fail-safe deny, human release |
| Verification | `src/evidence/` | `evidenceGate()`, refuter | Provenance before claim; refute before confirm; reproducibility on CI |
| Memory | `src/mission/` (durable) + `src/memory/context-window.ts` (ephemeral) | `Mission.record/addFinding`; `ContextWindow.append/render` | Append-only evidence ledger vs bounded, windowed context sent to the model |
| Capability | `src/tools/` | `ToolRegistry.execute()` | Schema-validated, risk-tiered typed tools |
| Execution | `src/agent/` | `runAgent(deps)` | The "dumb" ReAct loop; hard step/token ceilings; every call through the gate |
| Orchestration | `src/orchestration/` | decomposition round API | Honest decomposition into worker sub-tasks; never hides task shape (invariant #7) |
| Control (top) | `src/control/`, `src/cli.ts` | CLI verbs / mission lifecycle | Mission object, lifecycle, cost aggregation, NL intake |

**Memory plane split (implemented in Feature 5):** the durable ledger (`Mission`)
is authoritative and never summarized; the ephemeral `ContextWindow` is the lossy,
hard-capped view actually sent to the model. Findings always cite the ledger, never
the window.

## 2. Implementation invariants (unbypassable)

These already live in code, tests, and CI; the plane structure exists to keep them
enforceable. Scope before action · Provenance before claim · Refute before confirm ·
Human before consequence · Reproduce before report · Honest decomposition · Compose,
don't fork. See `CLAUDE.md §"Non-negotiable safety invariants"`.

## 3. Self-improving harness (RSI) — phased

Research note: self-improvement in modern AI typically begins by optimizing the
**deployment and harness layers**, not model weights. The optimization target
progresses linearly:

> instruction prompts → structured context → workflow → harness code → optimizer code

We adopt only the early, safe part of this ladder, and gate every code-level step
behind a human. The loop has three stages:

### 3a. Weakness mining (`src/rsi/weakness-mining.ts` — Feature 6)
Cluster mission failures into **failure patterns grounded by the verifier**. Requires
rich execution traces capturing terminal causes and causal state (the evidence
ledger + recorded lessons supply these), because different underlying mechanisms can
produce the same surface error. Output: ranked failure patterns, each tied to real
observations.

### 3b. Harness proposal (`src/rsi/proposal.ts` — Feature 6)
A proposer model suggests **bounded** edits to harness code. It operates in a bounded
context containing: editable surfaces, the failure patterns, successful behaviors to
preserve, and past edit attempts. The proposer receives an honest description of the
task (invariant #7) — decomposition is never used to hide intent from the model.

### 3c. Proposal validation (`src/rsi/validation.ts` — Feature 6)
Candidate edits run through regression tests on **held-in** data (the weakness is
actually fixed) and **held-out** data (no regressions introduced). Only candidates
that pass both are eligible to merge.

### 3d. Apply — HUMAN GATE (`src/rsi/apply.ts` — Feature 6)
An eligible candidate is emitted as a diff/branch and **stops at
`requireHumanRelease`**. The harness never applies a self-edit autonomously. This is
the hard boundary between "the harness proposes improvements" (built) and "the
harness rewrites itself" (deliberate future decision, not a side effect).

## 4. What is built vs roadmap

- **Built (Features 5–6):** plane formalization + drift test; ephemeral context
  window; opt-in lessons→planning advisory (Feature 4); the RSI loop skeleton
  (mine → propose → validate → human-gated apply) with committed held-in/held-out
  fixtures, run in dry-run by default.
- **Roadmap (not authorized here):** autonomous application of validated edits;
  optimizing the optimizer; any feedback that mutates prompts/tools/scope without a
  human in the loop. Enabling these is a separate, explicit decision.
