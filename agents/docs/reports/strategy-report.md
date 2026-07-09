# Strategy Report: Building the Veritas Meta-Harness

Derived from `agents/docs/processed/{strategy,operational,tactics}.md`, which extract the
reusable engineering patterns from the source reports in `agents/docs/`.

## Executive summary

The source strategy is a **safety-first, bottom-up composition strategy**: build one small,
safe, reproducible agent loop first (BASIC); add coordination, human oversight, and evidence
discipline second (INT); only then add cross-model orchestration and self-evaluation (ADV).
The strategic bet is that discipline (scope gates, provenance, adversarial verification,
reproducibility) is what makes a harness trustworthy enough to extend — not model capability.
This fits Veritas's mandate directly: a general-purpose research meta-harness that
instantiates a scoped "individual" per project sub-folder is exactly the loadout-composition
mechanism the strategy is built around.

## Strategic bets and their rationale

**1. Tier-gated capability (BASIC → INT → ADV, strictly bottom-up).**
Rationale: sophistication without a safety floor increases risk, not value. Placing the scope
gate in BASIC rather than INT is the clearest expression of this — "a harness that can act
before it can refuse is a liability." This is a deliberate ordering decision, not an
implementation convenience, and it should not be reordered even under schedule pressure.

**2. Compose, don't fork (loadouts as the unit of extension).**
Rationale: a domain = persona set + tool subset + target adapter + benchmark. New research
domains for Veritas (a new project sub-folder) become a new Loadout registration, never a copy
of the agent loop. This keeps the meta-harness's surface area constant as the number of
projects grows — the alternative (fork per domain) doesn't scale and fragments the safety
gates across copies.

**3. Provenance and adversarial verification as the trust mechanism.**
Rationale: model confabulation is the default failure mode of any agent that reports
findings. Two independent controls address it: the evidence gate (no finding without a real
tool observation behind it) and the refuter (a second model instance must fail to disprove a
finding before it's confirmed). The source explicitly calls the refuter "the single
highest-leverage quality mechanism in the repo" — worth prioritizing early in INT rather than
treating as optional polish.

**4. Reproducibility as a CI gate, not a report.**
Rationale: `verify-claims` re-derives every headline number from committed artifacts and
fails the build if it can't. This converts "trust me" into "receipts" — directly load-bearing
for a *research* meta-harness, where the output is claims about what was found or measured.

**5. Human-gated terminal actions.**
Rationale: automation stops one step short of anything consequential (send, publish, delete,
deploy, disclose) and produces a draft/plan instead. This is the strategy's answer to
"how autonomous should this get" — the answer is: fully autonomous up to the last
consequential step, never through it.

**6. Honest decomposition, not safeguard evasion.**
Rationale: the source material's parent project engineered its decomposition orchestrator
specifically to hide an offensive objective's shape from a safety-trained worker model. That
half of the pattern is rejected outright — adopted only as workload decomposition
(parallelism, cost, context budgeting) with each worker given a truthful subtask description.
This is a hard strategic boundary, not a nuance: any orchestrator work in this repo that
starts to resemble context-isolation-from-a-worker's-safety-training is out of scope,
independent of whether it would "work."

## Risk assessment

- **Unproven multi-agent coordination.** The source's own headline results came from a
  single-agent loop, not a coordinated swarm — treat ADV-tier orchestration as genuinely
  experimental, and validate BASIC/INT thoroughly (via the benchmark harness, §3.2 of
  tactics.md) before trusting multi-agent results.
- **Self-improvement is a recording mechanism, not a learning one, at present.** Don't assume
  the lessons loop closes the loop into future planning automatically — that's explicitly
  marked as roadmap in the source, and Veritas should treat it the same way unless it's
  deliberately built out.
- **Small-n benchmarks are directional.** Any benchmark suite built under `bench/` should be
  read as "does this look right," not "is this proven," until sample sizes grow.

## Fit to Veritas's mandate

`agents/config/agents-config.md` calls for: research-focused, general-purpose, per-project
instantiation, Python where scripting is required, modular skills, and evals for all work. The
strategy above satisfies each of these directly — Loadouts *are* the per-project instantiation
mechanism, the benchmark harness *is* the evals requirement, and the three Phase-4 skills
(tool-adder, eval-runner, refuter) are the "modular skills" the mandate asks for.

## Recommendation

Build strictly in the documented order (`agents/docs/processed/tactics.md` § Build order
checklist). Do not begin ADV-tier orchestration work until INT-tier evidence/refuter/
reproducibility gates are green — the strategic value of this harness comes from that
discipline, not from reaching multi-model orchestration quickly.
