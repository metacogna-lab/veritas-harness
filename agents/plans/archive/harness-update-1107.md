---
research_question: "What harness architecture do the RSI/meta-harness papers collectively point to?"
corpus:
  - hu-2025-adas
  - lee-2026-meta-harness
  - novikov-2025-alphaevolve
  - wang-2025-thetaevolve
  - ye-2026-mce
  - zhang-2025-ace
  - zhang-2025-dgm
  - zhang-2026-self-harness
excluded:
  - chen-2024-2401.01335 — 2024, out of date range
  - lu-2024-ai-scientist — 2024, out of date range
  - madaan-2023-self-refine — 2023, out of date range
  - yuan-2024-2401.10020 — 2024, out of date range
  - zelikman-2023-stop — 2023, out of date range
depth: deep
date: "2026-07-11"
papers_included: 8
papers_excluded: 5
---

# Meta-Analysis: Harness Architecture from RSI & Meta-Harness Research

## Research Question

What harness architecture do the RSI and meta-harness papers (2025–2026) collectively point to, and what specific changes does this imply for the Veritas harness?

## Corpus

8 papers included (2025–2026), 5 excluded (pre-2025 out of scope).

Included: `hu-2025-adas`, `lee-2026-meta-harness`, `novikov-2025-alphaevolve`, `wang-2025-thetaevolve`, `ye-2026-mce`, `zhang-2025-ace`, `zhang-2025-dgm`, `zhang-2026-self-harness`.

---

## Key Findings

### Converging Evidence

- **Harness design is the dominant performance lever, not model weights.** `lee-2026-meta-harness` quantifies a 6× performance gap from harness design alone on identical models. `zhang-2026-self-harness` shows the same base model jumping from 23.8% to 61.9% pass rate under an improved harness. The corollary: optimizing the model is secondary to optimizing what wraps it.

- **Code is the right substrate for agent design.** `hu-2025-adas`, `zhang-2025-dgm`, and `lee-2026-meta-harness` all represent agents and harnesses as code (Python/TypeScript), not natural language. Turing-completeness makes the search space theoretically complete. Text-only optimizers (OPRO, TextGrad) are shown empirically inferior to code-level search.

- **Queryable external history beats compressed in-context summaries.** Every high-performing system maintains an explicit, queryable store of historical data — not a summary fed into the next prompt: `lee-2026-meta-harness` uses a filesystem of source code + execution traces navigated via grep/cat (median 82 files/iteration); `zhang-2025-dgm` maintains a growing archive of agent variants; `hu-2025-adas` grows an archive of discovered agents with scores; `novikov-2025-alphaevolve`/`wang-2025-thetaevolve` maintain program databases of 10K+ entries. The single context window is a query interface to the store, not the store itself.

- **Incremental, auditable delta edits over monolithic rewrites.** `zhang-2025-ace` demonstrates context collapse from monolithic rewrites (18,282 tokens → 122 tokens, accuracy drops from 66.7% to 57.1%). `zhang-2026-self-harness` enforces targeted, minimal modifications with explicit regression gating. `lee-2026-meta-harness`'s best-discovered harness on TerminalBench-2 used a purely additive bootstrap with no rewrites. Convergent lesson: edits must be incremental, small, and individually defensible.

- **Empirical validation before any promotion.** `zhang-2025-dgm` validates every child agent on coding benchmarks before adding to archive. `zhang-2026-self-harness` requires non-regression on both held-in and held-out splits. `lee-2026-meta-harness` evaluates harness candidates against benchmark before they enter the filesystem. Nothing is promoted speculatively — every change earns its position via evidence.

- **Decoupled proposer / executor / validator roles.** All six HIGH-relevance papers separate these concerns: `zhang-2026-self-harness` has Weakness Miner / Proposer / Validator; `lee-2026-meta-harness` has Coding-Agent Proposer distinct from Target Agent; `ye-2026-mce` has Meta-Agent (skill evolution) / Base-Agent (execution); `zhang-2025-ace` has Generator / Reflector / Curator; `zhang-2025-dgm` has Archive + Parent-Selection / Self-Modifier / Evaluator; `hu-2025-adas` has Meta-Agent / Discovered Agent / Benchmark. Role separation is a universal pattern.

- **Open-ended archive exploration beats greedy single-path search.** `zhang-2025-dgm` ablation: removing the open-ended archive causes catastrophic forgetting and early plateau. `hu-2025-adas`: growing archive enables transfer across domains. `novikov-2025-alphaevolve`/`wang-2025-thetaevolve`: large program populations consistently outperform small ones. Suboptimal agents are kept as stepping stones, not discarded.

- **Bi-level optimization: meta-loop evolves the harness, inner loop executes tasks.** `ye-2026-mce` formalizes this explicitly (meta-level skill evolution + base-level context optimization). `lee-2026-meta-harness` implements the outer loop over harness code. `hu-2025-adas` implements it over agent designs. The pattern is universal: a slow outer loop improves the harness; a fast inner loop runs it.

### Divergences & Contradictions

- **Self-improving vs. external-proposer architecture.** `zhang-2026-self-harness` shows the same model can improve its own harness using its own traces, without stronger external agents. `lee-2026-meta-harness` requires a stronger external proposer to optimize a weaker target's harness. These are not contradictory but represent different operating modes: self-harness for incremental model-specific tuning; external meta-proposer for larger structural redesign. Both should exist as distinct Veritas modes.

- **Compression vs. accumulation for context.** Earlier CE methods (GEPA, prompt-rewriting) favor brevity. `zhang-2025-ace` and `ye-2026-mce` favor additive accumulation. `lee-2026-meta-harness` appears to contradict this — it achieves 4× fewer tokens — but the resolution is clear: the proposer accesses a filesystem, so the model's context window is small while the queryable store is large. Compression at the call level is fine when the data is queryable externally.

- **Bounded edits vs. open-ended code rewriting.** `zhang-2026-self-harness` recommends bounded, targeted edits with regression gating. `zhang-2025-dgm` permits full open-ended self-modification (entire codebase). DGM's approach is more powerful but takes ~2 weeks per run at significant cost. Self-Harness's bounded approach produces auditable, reversible improvements in hours. For production use, bounded edits are the right default; open-ended exploration belongs in a research/offline mode.

- **Same-model vs. stronger-model proposer.** `zhang-2026-self-harness` deliberately excludes stronger models and demonstrates self-improvement without them. `lee-2026-meta-harness` and `hu-2025-adas` use stronger proposers. Both work. The practical implication: use the same model with weakness mining for routine harness self-editing; use a stronger model for initial harness design and major structural revisions.

### Research Gaps

- **Formal safety bounds for self-modification.** All papers sandbox via containerization and regression gating, but none provides a formal framework bounding what changes are permissible. Veritas's safety invariants (`checkScope`, `requestApproval`, `requireHumanRelease`) fill this deliberately — the papers point to where Veritas already leads.

- **Harness portability across model generations.** `zhang-2026-self-harness` designs harnesses per-model; none of the papers study whether a harness designed for model A transfers to model B when the model is upgraded. This is a real operational gap for any production harness.

- **Multi-objective harness optimization.** Most papers optimize a single metric. `lee-2026-meta-harness` mentions a Pareto frontier. `ye-2026-mce` shows context-efficiency gains alongside accuracy gains. Systematic multi-objective optimization (accuracy + cost + latency + safety + scope compliance) is absent from all papers.

- **Long-horizon cumulative improvement across sessions.** `zhang-2026-self-harness` studies bounded edits within a single session. `zhang-2025-dgm` goes open-ended but at extreme upfront cost. Cumulative bounded improvement across many operational sessions — the obvious production mode — is not yet studied.

- **Self-improvement loop safety under adversarial input.** None of the papers study whether a self-improving harness can be manipulated by adversarial task inputs to make unsafe changes to itself. Veritas's scope gate and approval gate are the current mitigations.

### Chronological Arc

**2023 (foundations).** Self-improvement was demonstrated at the capability level: STaR bootstrapped reasoning from self-generated rationales; Self-Refine showed iterative critique improves outputs. Human-designed loops, no harness self-modification, proof-of-concept scale.

**2025 (bifurcation and scale).** Two major lines emerge. First, code-as-substrate: ADAS (Hu et al.) represents agents as Python and shows a meta-agent programming ever-better agents outperforms human design; DGM (Zhang et al.) closes the self-referential loop, letting agents modify their own codebases and validating each change against benchmarks. Second, context-as-accumulation: ACE introduces evolving playbooks over monolithic prompts; AlphaEvolve/ThetaEvolve demonstrate evolutionary loops at scale for optimization domains. Both lines independently converge on the same finding: full historical access (archive or playbook) dramatically outperforms compressed feedback.

**2026 (harness as first-class artifact).** Meta-Harness (Lee et al.) formalizes the outer-loop over harness code with filesystem-based history access. MCE (Ye et al.) frames CE as bi-level co-evolution of skills and context. Self-Harness (Zhang et al.) demonstrates that the same model can improve its own operating harness without external agents, using weakness mining over its own execution traces. The field has shifted from "agents that improve their outputs" → "agents that improve their harnesses" → "harnesses that improve themselves."

Key inflection point: Lee-2026 notes the workflow "only became practical following major improvements in coding-agent capabilities around early 2026." This suggests current frontier coding agents (Claude Sonnet 4.6, 2026 baseline) are now on the capability threshold where harness self-improvement is operationally viable.

### Methodological Patterns

1. **Benchmark before promotion** — every accepted change is validated on held-out data before entering the production harness or archive. Non-regression is the minimum bar; improvement on held-out split is preferred.
2. **External queryable stores** — filesystem, archive, program database — structured for grep/cat/semantic search, not for ingesting into a single prompt.
3. **Universal role separation** — proposer / executor / validator are always distinct, even if backed by the same model.
4. **Sandboxing all generated/modified code** — containerization, strict time limits, restricted scope (DGM, Self-Harness, Meta-Harness all independently converge on this).
5. **Archive diversity over greedy optima** — all evolutionary systems permit suboptimal variants as stepping stones. Quality-Diversity beats pure greedy selection.
6. **Delta-based updates with regression gating** — targeted incremental edits, each individually testable and reversible, rather than wholesale rewrites.

---

## Synthesis

The eight 2025–2026 papers collectively point to a single coherent architecture: **a bi-level system in which an outer loop evolves the harness as code, using a queryable filesystem of execution history, while an inner loop runs agent tasks under the current harness.** The outer loop operates via role-separated agents (proposer, validator) making incremental, regression-gated edits. The inner loop accumulates evidence — traces, scores, failure clusters — in machine-readable formats navigable by the outer loop. No information is lost to compression; it is offloaded to the store and queried on demand.

The Veritas harness is architecturally well-positioned. Its existing BASIC→INT→ADV tier structure maps directly onto the inner loop (BASIC/INT, task execution) and outer loop (ADV, decomposition orchestrator and benchmark harness). The append-only transcript and findings in `src/mission/` are the embryo of the experience store. The specialist Loadout model in `src/agent/specialists.ts` is the embryo of the code-represented harness that an outer loop could read and modify. The `src/evidence/refuter.ts` is a specialized validator. The missing pieces are: (1) a structured, queryable format for the experience store; (2) the weakness-mining step from Self-Harness; (3) the outer-loop harness proposer backed by a stronger model; and (4) regression-gating infrastructure that can evaluate a candidate harness on a held-out eval set before promotion.

The papers are also consistent with Veritas's safety invariants. The universal patterns — sandbox before modify, validate before promote, human-release before consequence — are independent discoveries that converge on the same design as Veritas's non-negotiables §1–7. Where the papers go silent (formal bounds on what changes are permissible), Veritas's invariants fill the gap.

The evolutionary papers (DGM, ADAS, AlphaEvolve, ThetaEvolve) point to an important capability for the ADV phase: an open-ended exploration mode that maintains a branching archive of harness variants rather than a single lineage, allowing the system to escape local optima. This is distinct from — and should not replace — the bounded incremental mode appropriate for production operation.

---

## Harness Update Recommendations (harness-update-1107)

These are concrete changes to the Veritas harness implied by the synthesis above, ordered by priority.

### Priority 1 — Experience Store (Phase 2 INT addition)

**What the papers say:** `lee-2026-meta-harness` (median 82 files/iteration, up to 10M tokens of navigable history), `zhang-2025-dgm` (queryable archive with lineage), `hu-2025-adas` (growing archive with scores).

**Change:** Extend `src/mission/` to write structured, queryable output files per mission run:
```
resources/experience/<mission-id>/
  harness-config.json      # snapshot of specialist loadout + tool config used
  transcript.jsonl         # append-only tool calls and observations (already exists)
  findings.jsonl           # accepted findings with provenance (already exists)
  scores.json              # benchmark task pass/fail outcomes
  failure-clusters.md      # weakness-mining output (new)
```
Structure everything for `grep`/`jq` navigation. The outer loop reads this store, not a compressed summary.

### Priority 2 — Weakness Mining Step (Phase 3 ADV or Phase 4 Skill)

**What the papers say:** `zhang-2026-self-harness` (cluster failed execution traces → identify recurring failure patterns → generate minimal targeted harness edits).

**Change:** Add `src/self-improve/weakness-miner.ts`:
- Input: mission transcripts from the experience store, filtered to failed tool calls and rejected findings.
- Process: cluster failures by pattern (loop type, scope denials, parse failures, refuter rejections).
- Output: `failure-clusters.md` in the experience store — a ranked list of recurring failure patterns with supporting trace excerpts.
- Safety gate: weakness miner is read-only; it never modifies the harness. Output goes to the experience store only.

### Priority 3 — Harness Proposer (Phase 3 ADV)

**What the papers say:** `lee-2026-meta-harness` (coding-agent proposer with filesystem access), `zhang-2026-self-harness` (proposer role backed by same model, generating K diverse minimal edits per failure cluster).

**Change:** Add `src/self-improve/harness-proposer.ts`:
- Input: `failure-clusters.md` + current harness config snapshot (specialist prompts, tool allowlists, scope rules).
- Process: for each failure cluster, generate 2–3 minimal candidate harness edits as TypeScript diffs (targeting `src/agent/specialists.ts`, `src/tools/`, or `src/safety/scope.ts`).
- Output: candidate diffs, each tagged with: the failure pattern it addresses, the harness surface modified, and the evidence motivating it.
- Model: use the strongest available model (claude-opus-4-8 or stronger) for proposer role; not the default Sonnet model.
- Constraint: edits must remain within the current loadout structure. They cannot add new tools beyond the registered tool registry or modify the safety invariants (§1–7). The scope gate and approval gate are frozen.

### Priority 4 — Regression-Gating Infrastructure (Phase 3 ADV)

**What the papers say:** `zhang-2026-self-harness` (held-in + held-out non-regression required), `zhang-2025-dgm` (benchmark validation before archive admission), `lee-2026-meta-harness` (syntax check + benchmark eval before filesystem entry).

**Change:** Extend `scripts/bench.mjs` to support harness candidate evaluation:
- Accept a candidate harness config path alongside the benchmark suite.
- Run the benchmark suite against the candidate config (in sandbox).
- Compare scores against the current harness baseline.
- Emit a promotion decision: `promote` (held-out improves, held-in does not regress), `hold` (mixed results), or `reject` (regression on either split).
- Never auto-promote; always require explicit human approval before merging candidate into the active harness config (`bun run verify-harness-candidate` in CLAUDE.md workflow).

### Priority 5 — Bi-Level Skill Evolution (Phase 4 Skills)

**What the papers say:** `ye-2026-mce` (meta-agent evolves CE skills via agentic crossover over skill history, execution trajectories, and performance metrics), `lee-2026-meta-harness` (outer loop reads all prior harness source + traces via filesystem).

**Change:** Add a `harness-evolver` skill to `skills/` (meta-root, generic skill):
- Triggered by `/evolve-harness` command.
- Reads the full experience store for all missions run under the current loadout.
- Proposes loadout-level changes (not just prompt patches): specialist role definitions, tool allowlists, scope configurations, evaluation criteria.
- Produces a candidate `loadout-candidate/` folder rather than a diff, which can be evaluated as a first-class new loadout before promotion.
- This is the outer-loop counterpart to the inner-loop weakness miner + proposer.

### Priority 6 — Structured Lessons with Delta Updates (existing `resources/lessons.ts`)

**What the papers say:** `zhang-2025-ace` (delta bullets with helpfulness/harmfulness counters, non-destructive accumulation), `ye-2026-mce` (context as files + code, not predefined schemas).

**Change:** Refactor `src/resources/lessons.ts` from a flat append store to a structured delta store:
- Each lesson entry: `{ pattern, harness_surface, change_description, evidence_mission_ids, helpfulness_count, harmfulness_count, status: "active"|"deprecated" }`.
- Lessons accumulate; they are never deleted, only marked deprecated.
- `helpfulness_count` and `harmfulness_count` are updated each time the lesson is applied and the outcome is observed.
- The weakness miner can query lessons by harness surface (e.g., "all lessons affecting `specialists.ts`") to avoid proposing already-tried edits.

---

## Suggested Next Steps

- **Implement the experience store first** (Priority 1) — all other improvements depend on having structured, queryable mission history. This is a non-breaking extension to `src/mission/`.
- **Wire `scripts/bench.mjs` for candidate evaluation** (Priority 4) — needed before any harness proposal can be safely tested. Can be done in parallel with Priority 1.
- **Prototype weakness miner as a standalone script** (Priority 2) — before integrating into `src/`, validate it on existing mission transcripts to confirm the cluster quality.
- **Study harness portability** — when the Veritas harness is next updated to target a new base model, record which loadout decisions transferred and which did not. This directly addresses the research gap the papers leave open.
- **Review DGM's open-ended archive design** (`zhang-2025-dgm`) — when Phase 3 ADV orchestration is being implemented, the archive-of-loadouts pattern from DGM (branching, diversity-preserving, stepping-stone based) should inform the orchestration design rather than a single-lineage approach.

---

meta-analysis complete: `agents/plans/harness-update-1107.md`
