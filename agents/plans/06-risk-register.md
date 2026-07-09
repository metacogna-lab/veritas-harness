# Plan 06 — Risk Register and Explicit Boundaries

Consolidated from `agents/docs/processed/strategy.md`, `operational.md`, and
`agents/docs/reports/strategy-report.md`. Read this before starting ADV-tier work
(`03-phase-adv.md`) in particular.

## The eight non-negotiable safety invariants

Every phase plan references these; they are restated here as the single checklist to
audit against at any point in the build.

1. **Scope before action.** No side-effecting tool runs outside the mission's declared
   scope. (`01-phase-basic.md` §1.4)
2. **Fail-safe deny.** A gated tool with no approver wired, unattended, is denied — never
   silently fired. (`02-phase-int.md` §2.2)
3. **Provenance before claim.** No finding is accepted without a real tool observation
   behind it. (`02-phase-int.md` §2.3)
4. **Refute before confirm.** A second model instance must fail to disprove a finding
   before it is promoted to confirmed. (`02-phase-int.md` §2.4)
5. **Human before consequence.** Terminal actions with real-world effect stop one step
   short and require explicit human release. (`03-phase-adv.md` §3.3)
6. **Reproduce before report.** Every headline number re-derives from committed artifacts.
   (`02-phase-int.md` §2.6, `03-phase-adv.md` §3.2)
7. **Honest decomposition.** Orchestrator workers get a truthful description of their
   subtask; no context-isolation to route around a worker model's safety behavior.
   (`03-phase-adv.md` §3.1)
8. **Compose, don't fork.** New purposes are a new Loadout registration, never a copy of
   the agent loop. (`02-phase-int.md` §2.1)

If any implementation task in `01`–`04` would require violating one of these, stop and
reconsider the task rather than the invariant.

## Explicit boundary: what this harness is not for

The architectural patterns in `agents/docs/` derive from analysis of an offensive-security
framework, extracted purely as engineering patterns. Two things from that source are
excluded entirely, not just de-scoped:

- **No context-isolation orchestration.** An orchestrator that deliberately withholds
  parts of an objective from a worker model to prevent that model's own safety training
  from engaging is not a variant of 3.1 — it is the thing 3.1 explicitly prohibits.
- **No adversarial prompt-injection technique catalogue.** If a "red-team" or
  "adversarial testing" Loadout is ever proposed, its tools/prompts are built to test that
  *this* harness resists such techniques (per the defensive checklist below), not to
  reproduce an offensive catalogue.

### Defensive checklist for any Loadout that ingests untrusted external content
(web pages, tool output, files)

- [ ] Fetched/tool content never occupies the same trust level as the system prompt
- [ ] Zero-width and homoglyph unicode are stripped from ingested text before it reaches
      the model
- [ ] Model-proposed tool calls are treated as proposals subject to the approval gate
      (invariant 2), never auto-executed because the content "looked authoritative"
- [ ] A refuter check (invariant 4) sits between "model said so" and "acted on it"

## Known risks (carried over from the source material's own honest assessment)

| Risk | Source | Mitigation in this plan set |
|------|--------|------------------------------|
| Multi-agent/orchestrated coordination is largely unproven; upstream headline results came from a single-agent loop | strategy.md, strategy-report.md | Treat ADV orchestration (3.1) as experimental; validate BASIC+INT thoroughly via 05's benchmark suite before trusting multi-agent results |
| Self-improvement loop currently records lessons but does not feed them back into planning automatically | strategy.md §Honest trade-offs | 3.4 explicitly marks recording vs. roadmap; do not silently expand scope to "the harness learns" |
| Small-n benchmark results are directional, not definitive | strategy.md, strategy-report.md | 05's standing rule: report n and a confidence interval, never present small-n as definitive |
| Decomposition orchestrator's evasion framing is a liability under hosted-model provider terms | strategy.md, strategy-report.md | Hard-excluded per "Explicit boundary" above; enforced by the 3.1 honest-decomposition test |
| White-box source ingestion patterns in the source material cost more tokens, not fewer, and are language-specific (Python regex in the original) | strategy.md | Not adopted in this plan set; if source-ingestion tooling is added later, benchmark its token cost before assuming it's cheaper |

## Open questions to resolve before/during implementation

- [ ] Which providers (from `01-phase-basic.md` §1.1: anthropic/openai/openrouter/local)
      are actually available in the target environment, and what should `defaultProvider`
      be for the first real Loadout?
- [ ] What is the first real objective/Loadout this harness will run, to use as the
      "trivial objective" smoke test in `01-phase-basic.md` and the first benchmark suite
      in `03-phase-adv.md`?
- [ ] Where does `~/.harness/config.json` live in the target deployment environment, and
      does it need to differ per project sub-folder (per the meta-harness's per-project
      instantiation goal)?
- [ ] Does the HTTP API (`02-phase-int.md` §2.5) need auth of its own, or is it assumed to
      run only on localhost / behind an already-trusted boundary? Resolve before exposing
      it beyond local development.
