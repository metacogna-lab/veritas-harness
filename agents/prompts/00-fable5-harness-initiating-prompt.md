# Fable 5 Initiating Prompt — Harness Build

Synthesized from `agents/plans/00-overview.md` through `06-risk-register.md`, and from
Anthropic's own prompting guidance for Claude Fable 5 (long-horizon agentic work: give the
goal and constraints, not a step-by-step script; state the reason behind the request; expect
and plan for long, mostly-unattended turns).

## How to use this

- **Model:** `claude-fable-5` (or `claude-mythos-5` under Project Glasswing).
- **Effort:** `xhigh` — Fable 5's own guidance calls this the best setting for coding and
  agentic work; thinking is always on for this model, so there's no `thinking` parameter to
  set.
- **Where to paste:** the first user turn of a fresh agent session (Claude Code or equivalent
  harness) with the model set to Fable 5, working directory at the repo root (`veritas/`).
- **Expect long turns.** Single requests on a build phase can run many minutes — that's
  normal for Fable 5 on long-horizon work, not a stall.
- This prompt deliberately does not restate the plan documents' task lists. Fable 5 is
  instructed to read them and decompose the work itself — over-specifying steps for this
  model tends to reduce output quality rather than improve it.

---

## The Prompt

I'm building a general-purpose research meta-harness — a single agent loop, tool registry,
and safety/evidence spine that gets reused unchanged across research domains, where a new
research "purpose" is added as a registered loadout rather than a fork of the core. You're
being brought in for this specifically because it's a long-horizon, high-reasoning build
where judgment on sequencing, tradeoffs, and when a design decision is "good enough" matters
more than following a fixed script.

The full plan already exists. Read it yourself, in this order, and decompose each phase's
actual work from what you read there — I'm not re-deriving the task list here:

1. `agents/plans/00-overview.md` — scope, target layout under `harness/`, and what "done"
   means for the whole build.
2. `agents/plans/01-phase-basic.md`, then `02-phase-int.md`, then `03-phase-adv.md`, then
   `04-phase-skills-and-consumability.md` — the four build phases, strictly in that order.
   Do not start a phase until the previous phase's Definition of Done is met and passing
   under test, not just written.
3. `agents/plans/05-verification-and-benchmarks.md` — the verification practices that apply
   across every phase, not just at the end.
4. `agents/plans/06-risk-register.md` — the eight non-negotiable safety invariants and the
   explicit boundary on what this harness is not for. Treat these as constraints on every
   phase you build, not a checklist to satisfy retroactively.

Also read `CLAUDE.md` at the repo root and `agents/config/agents-config.md` for the standing
operating mandate, if you haven't already picked them up.

Work through the phases sequentially. Within each phase, decide your own task breakdown,
order, and when to write tests versus implementation — the plan documents give you file
targets, interfaces, and acceptance criteria, not an implementation script. Use your own
judgment on:

- how to structure each module internally (specified as behavior/interface, not code)
- when something is genuinely blocked on a decision only a human can make, versus a
  reasonable default you can pick, note, and move past
- how to sequence sub-tasks within a phase for the least wasted work
- where two pieces of a phase are independent — delegate them to subagents and keep working
  rather than serializing everything through yourself

A few operating notes, since you'll be running long and mostly unattended:

- **Verify before you claim.** Before reporting a phase — or any task — done, run the actual
  command (`bun test`, `bun run verify-claims`, `bun run doctor`) and read its output. Don't
  report completion on the strength of having written the code; the plan's Definition of Done
  sections exist to be checked, not assumed.
- **Stay in scope.** Build exactly what each phase's plan asks for — no extra abstractions,
  no refactoring adjacent code that already works, no tooling nobody asked for. If you notice
  something that should change later, note it rather than doing it now.
- **Keep a running note.** Use `agents/state/build-log.md` (create it if it doesn't exist) to
  record, per phase: what you built, any judgment calls you made and why, and anything you
  deferred. Check it at the start of a session so you're not re-deriving decisions you already
  made.
- **Ask only when genuinely blocked.** Missing credentials, a decision that changes the shape
  of the whole system, or a plan document that contradicts itself — surface those. A naming
  choice, a reasonable default config value, or "which of two equivalent approaches" are not
  — pick one, note it in the build log, keep going.
- **Ground progress claims in evidence.** If you say a tool works, a gate denies correctly, or
  a test passes, that claim should trace to a tool result from this session, not to having
  written code that you expect to behave that way.
- **When you report status, lead with the outcome.** What's built, and whether it's verified,
  comes first. Save dense step-by-step narration for your own working notes — a human reading
  your summary should get the "what happened" in the first sentence, not after a recap of
  every file you touched.

Start with `agents/plans/00-overview.md`, then begin Phase BASIC.
