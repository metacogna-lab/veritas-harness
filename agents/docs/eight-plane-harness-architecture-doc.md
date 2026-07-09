1. The 8-Plane Architecture
A robust meta-harness should be decoupled into orthogonal planes with narrow interfaces. Mixing these concerns is the primary cause of unmaintainable agent frameworks.

Provider Plane (Bottom): Abstracts the LLM to provide a single interface (e.g., complete()) hiding provider quirks. It is responsible for fallback chains on transient failures, cost and token accounting per mission, and providing a text-mode tool shim so non-function-calling local models can participate.

Safety Plane: A pure, I/O-free plane that enforces non-negotiable rules. It implements scope containment to deny off-scope targets by default, risk tiers to gate intrusive tools, and fail-safe deny rules to ensure unattended runs never silently execute dangerous actions. It also enforces human-release checkpoints for terminal actions.

Verification Plane: The critical difference between a demo and a system. It includes an evidence gate that rejects any claim lacking a corresponding tool observation, and an adversarial refuter, where a separate model attempts to disprove findings before they are promoted. It also runs reproducibility scripts on CI to re-derive metrics.

Memory Plane: Divided into two concepts: the durable, append-only evidence ledger that records every tool call and observation with strict provenance, and the ephemeral, windowed context that handles rolling summaries and scratchpads sent to the model.

Capability Plane: The typed tool registry. Tools must be validated against a schema at the boundary before execution and carry a strict risk tier (e.g., active, dangerous).

Execution Plane: The ReAct loop itself. It must remain "dumb" and strictly enforce hard ceilings on steps and token budgets to prevent runaway loops. Every tool call must route through the Safety Plane's gate.

Orchestration Plane: Decomposes higher-level objectives into sub-tasks for worker models. It is critical that this delegation remains "honest"—workers must receive a truthful description of their tasks, and decomposition should never be used as an anti-pattern to evade a worker model's safety training.

Control Plane (Top): Owns the mission object, lifecycle management (start, running, verifying, report), cost aggregation, and natural-language intake.

2. Implementation Invariants
Any implementation must adhere to strict, unbypassable invariants:

Scope Before Action: No tool capable of side effects can execute without its target passing the safety gate.

Provenance Before Claim: Findings that cannot point to a real observation in the ledger are confabulations and must be rejected.

Refute Before Confirm: A second model instance must fail to knock down a finding using only the committed evidence before it is trusted.

Human Before Consequence: The automation must stop one step short of consequential actions (e.g., deployment, deletion), generating a draft for a human to release.

3. Evolutionary Search and Recursive Self-Improvement (RSI)
Integrating insights from Lilian Weng's July 2026 research on "Harness Engineering for Self-Improvement," the meta-harness architecture naturally extends into AI self-improvement.

Weng notes that RSI in modern AI often begins with optimizing the deployment and harness layers rather than immediately rewriting model weights. The optimization target progresses linearly: instruction prompts → structured context → workflow → harness code → optimizer code.

To build a "Self-Improving Harness," Weng proposes a three-stage loop:

Weakness Mining: The harness clusters failures into failure patterns grounded by a verifier. It requires rich execution traces capturing terminal causes and causal states, since different underlying mechanisms can yield the same surface-level error.

Harness Proposal: A proposer model suggests bounded edits to the harness code. The model operates within a bounded context containing editable surfaces, failure patterns, successful behaviors to preserve, and past edit attempts.

Proposal Validation: Candidate edits are run through regression tests on held-in data (to ensure the weakness is fixed) and held-out data (to ensure no regressions are introduced). Only candidates that pass both are merged.