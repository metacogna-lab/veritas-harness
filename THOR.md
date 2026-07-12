# ⚡ THOR — The Meta-Harness

## 🧠 The Philosophy

A language model supplies **judgment**. The harness supplies **structure, safety, and reproducibility** — never the reverse. This is the central design axiom: the model is the brain, and the harness is discipline.

THOR is a general-purpose research meta-harness: a tiered agent framework (**BASIC → INT → ADV**) that instantiates a scoped, auditable "individual" per project sub-folder. It is not one more agent framework — it is a framework *for building agent frameworks*. A reusable spine of loop, gates, ledger, refuter, verifier, orchestrator, and control plane that stays **unchanged** while only the objective-specific tools, specialist personas, and target adapter are swapped. That composition property — **compose, don't fork** — is what makes it a *meta*-harness.

---

## 🏗️ The Architecture

Eight orthogonal planes with narrow interfaces, built bottom-up so no layer depends on a capability that doesn't yet exist.

**🔌 Provider Plane.** A single `complete()` method normalises chat, streaming, and token budgets across Anthropic, OpenAI, OpenRouter, and local models (Ollama, LM Studio, vLLM). A text-mode tool-calling shim lets non-function-calling models participate. Retry with exponential backoff, configurable fallback chains, and cost/token accounting per mission.

**🛡️ Safety Plane.** Pure, I/O-free predicates enforced unconditionally. The **scope gate** (`checkScope`) denies any side-effecting tool that targets a host or path outside the mission's declared scope — off-scope, loopback, and private ranges denied by default. The **approval gate** holds `intrusive`, `credential`, and `dangerous` tools inert until a human approves them, warning loudly on every subsequent call. Fail-safe: an unattended run with no approver wired denies every gated tool. Every tool call routes through both gates, in order, always.

**🔬 Verification Plane.** The critical difference between a demo and a system. The **evidence gate** rejects any finding that cannot point to a real tool observation in the mission log — the antidote to model confabulation. The **adversarial refuter** spins up a separate model instance (different model or temperature) tasked with disproving a finding using only committed evidence. Survives → confirmed. Fails → retracted, with the refuter's reasoning logged. Adversarial checking is not optional polish — it is the harness's primary quality mechanism.

**🗃️ Memory Plane.** A strict separation between the append-only, provenance-tagged **evidence ledger** (every tool call, every observation, immutable after write — the only source for findings) and the ephemeral, windowed **context** (rolling summaries and scratchpads fed to the model on each ReAct step).

**🔧 Capability Plane.** A typed tool registry. Every tool carries a name, description, Zod input schema, and a risk tier. Input is validated against the schema before execution at the boundary — not inside the tool. The tool itself is a pure function from validated input to string observation.

**⚙️ Execution Plane.** The ReAct loop — deliberately kept "dumb." Reason → propose action → execute through the safety gate → observe → repeat → stop on a final answer or hit a hard, non-negotiable step ceiling. The loop emits typed events (`step`, `toolCall`, `observation`, `done`, `error`) so any CLI, UI, or API can subscribe. No domain knowledge, no special cases, no exceptions. The fixed spine, reused unchanged across every use case.

**🌐 Orchestration Plane.** A master-builder decomposes a large objective into independent sub-queries, dispatches them in parallel to worker models (optionally cheaper ones) with bounded concurrency, and synthesises results over rounds with accumulated-knowledge memory. This is workload decomposition only — parallelism, cost optimisation, context budgeting. Every worker receives a **truthful, complete** description of its subtask. Context-isolation designed to hide an objective's shape from a worker model to route around its safety training is **explicitly forbidden** — the one pattern from the source material that is an anti-pattern, not a feature.

**🎛️ Control Plane.** A CLI and optional HTTP API. Natural-language intake resolves a plain-English objective into a `Mission` + `Loadout`. A mission owns its lifecycle (pending → running → verifying → done/error), an append-only transcript, cost aggregation, and a set of findings that have passed the evidence gate and survived the refuter.

---

## 📈 The Tiered Build

Nothing in the tier structure is arbitrary. Each tier is a precondition for the next.

**BASIC.** One agent, one loop, one tool set, running safely and reproducibly. The provider abstraction, typed config, scope gate, tool registry, robust parser, and append-only mission object. The minimum viable harness — safe in isolation, single-purpose by design. No dangerous tools anywhere in the tree; gated by architecture starting in INT.

**INT.** Multiple specialists, human-in-the-loop safety, and evidence you can trust. Specialist loadouts that compose into the same loop (the meta-harness property). Approval gating with fail-safe deny. The evidence ledger and provenance gate. The adversarial refuter. CLI control plane and HTTP API. Reproducibility guard wired to a pre-push hook: any claim that cannot be re-derived from committed artifacts does not ship.

**ADV.** Orchestration across models, honest benchmarking, and structured improvement. The decomposition orchestrator (truthful subtask descriptions only — verified by test). Benchmark harness with committed ground-truth oracles, Wilson-95 confidence intervals, and an anti-fitting guard that fails the build if grading logic references specific test answers. Human-gated terminal actions: the harness stops one step short of any consequential action (send, publish, delete, deploy, disclose). A lessons loop that records structured takeaways from each mission, with a clear boundary between what is live (recording) and what is roadmap (automatic feedback).

---

## 🔒 The Eight Non-Negotiable Safety Invariants

These are not guidelines. They are baked into **code, tests, and CI**:

| # | Invariant |
|---|-----------|
| 1 | **Scope before action** — no side-effecting tool runs outside the mission's declared scope |
| 2 | **Fail-safe deny** — a gated tool with no approver wired, unattended, is denied — never silently fired |
| 3 | **Provenance before claim** — no finding is accepted without a real tool observation behind it in the mission log |
| 4 | **Refute before confirm** — a second model instance must fail to disprove a finding before it is promoted |
| 5 | **Human before consequence** — terminal actions stop one step short and require explicit human release |
| 6 | **Reproduce before report** — every headline number re-derives from committed artifacts |
| 7 | **Honest decomposition** — orchestrator workers always get a truthful description of their subtask |
| 8 | **Compose, don't fork** — new capability domains are a new loadout registration, never a copy of the agent loop |

If any task would require violating one of these, the task must be reconsidered — **not the invariant**.

---

## 🧩 Loadout Composition

A domain is a **Loadout**: specialist personas + a tool subset + a target adapter + a benchmark suite. To adapt the harness to a new purpose, you change exactly **three things**:

- `src/tools/` — the capabilities the objective needs
- `src/agent/specialists.ts` — roles, system prompts, and tool allowlists
- The target adapter — how a mission's scope is described for that domain

Everything else — the loop, the scope gate, the approval gate, the ledger, the refuter, the verifier, the orchestrator, the control plane — is **reused unchanged**. That reuse is the meta-harness. A second loadout that requires zero changes to the core is the proof that the harness is actually multi-purpose.

---

## 🤖 Self-Extension (Skills)

The harness is designed to extend itself. Three codified capabilities turn it into its own tool-building platform:

🔨 **`harness-tool-adder`** — reads the registry interface, creates a new typed tool with an appropriate risk tier, ensures the scope gate covers it, registers it, tests it. Never registers a dangerous tool without a tier that forces the approval gate.

📊 **`harness-eval-runner`** — creates benchmark suites with committed ground-truth oracles and held-out tasks, runs them, verifies the numbers re-derive. Grade never references the specific test answers — the anti-fitting guard enforces this.

🔍 **`harness-refuter`** — loads a finding and its provenance, spawns a refuter model to attempt to disprove it, records the outcome. Never reports a finding as confirmed that lacks provenance or was retracted.

These skills are accessible through slash commands (`/add-tool`, `/verify`, `/bench`, `/new-loadout`) and through an MCP server that exposes a safe, scope-gated subset of the harness to other agents.

---

## 🚫 What This Harness Is Not

The architectural patterns here derive from analysis of an offensive-security multi-agent framework, extracted purely as engineering artifacts. Two things are **excluded entirely**:

- **No context-isolation orchestration.** An orchestrator that withholds parts of an objective from a worker model to route around its safety training is not a variant of honest decomposition — it is the thing the seventh invariant explicitly prohibits.

- **No adversarial prompt-injection technique catalogue.** If a red-team loadout is ever proposed, its tools and prompts are built to test that *this* harness resists such techniques — never to reproduce an offensive catalogue.

---

## 🎯 The Through-Line

The model is the brain; the harness is discipline. Reproducibility, provenance, adversarial verification, and hard safety gates are what separate a meta-harness from a prompt with delusions of grandeur.

THOR builds **structure first, capability second** — because sophistication without a safety floor increases risk, not value. The tiered build (BASIC → INT → ADV) is a strategic constraint, not an implementation convenience. Each tier's trust properties are a precondition for the next, and no tier is skipped.

The result is not a single agent. It is a **factory for safe, reproducible agents** — one per purpose, all sharing the same disciplined spine.
