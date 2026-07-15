# Plan 02 — Phase INT: The Coordinated, Auditable Harness

Goal: multiple specialists, human-in-the-loop safety, and evidence you can trust.

Dependencies: Phase BASIC's DoD is met (`01-phase-basic.md`). Every task below composes on
top of the scope gate, tool registry, mission object, and agent loop — none of them are
replaced.

## Tasks

### 2.1 Specialist loadouts — `src/agent/specialists.ts`
- [ ] `Specialist = { role, systemPrompt, toolAllowlist }`
- [ ] `Loadout = { specialists[], toolRegistrySubset, targetAdapter, benchmark? }`
- [ ] Refactor `Agent` (from 1.3) to accept a `Specialist` so role-scoped agents can run
      without changing the loop itself
- [ ] A `Loadout` registry so new domains register a Loadout rather than branching the loop
- [ ] Tests: two distinct Loadouts sharing the same loop, producing different tool
      allowlists and prompts at runtime

### 2.2 Approval gate + risk-tier gating — `src/safety/approval.ts`
- [ ] Pure module (no I/O) — host process injects the approver + a warning sink
- [ ] `GATED_TIERS = {intrusive, credential, dangerous}`: inert until approved;
      approve-once-then-free for the rest of the session
- [ ] `SPICY_TIERS = {credential, dangerous}`: emit a loud, audited (non-blocking) warning
      on **every** call, even once approved
- [ ] Two approval paths: interactive (ask the human on first use) and pre-authorized
      (headless/batch runs get an explicit allowlist up front; anything off-list denies;
      every decision is audited)
- [ ] **FAIL-SAFE**: a gated tool with no approver wired and no pre-authorization is
      DENIED — never silently fires
- [ ] Compose `src/safety/index.ts`: `check(call, mission, policy)` = `checkScope()` (1.4)
      then `requestApproval()` (2.2) — scope is checked first, unconditionally
- [ ] Wire `Agent.run()` to call `safety.check()` for every tool call, replacing the 1.3 stub
- [ ] Tests with fake approvers covering: interactive approve, interactive deny,
      pre-authorized allow, pre-authorized off-list deny, unattended fail-safe deny

### 2.3 Evidence ledger + provenance gate — `src/evidence/gate.ts`
- [ ] A `Finding` must carry provenance: which tool call + which observation produced it
- [ ] `evidenceGate(finding)` rejects any finding not backed by a real tool observation
      present in the mission log
- [ ] `Mission.addFinding()` routes through the gate; rejected findings never enter the
      append-only findings array
- [ ] Tests: a fabricated finding with no matching transcript entry is rejected; a finding
      with valid provenance is accepted

### 2.4 Adversarial verification (the refuter) — `scripts/verify-finding.mjs` + `src/evidence/refuter.ts`
- [ ] Before a finding is promoted to `confirmed`, a SEPARATE model instance (different
      model or temperature from the one that produced the finding) is prompted to disprove
      it using ONLY the committed evidence in the mission log
- [ ] Survives refutation → `confirmed`; fails → `retracted`, with the refuter's reason
      logged alongside the finding
- [ ] Test that feeds a known-false finding and asserts it gets retracted
- [ ] Treat this as the highest-priority task in this phase — it is the harness's primary
      quality mechanism, not an optional add-on

### 2.5 Control plane — `src/cli.ts` (+ optional `src/server.ts`)
- [ ] CLI verbs: `start "<objective>" --scope <...>`, `status <id>`, `report <id>`
- [ ] A natural-language front door: resolve a plain-English objective into a `Mission` +
      `Loadout`, launch the agent, stream events to stdout
- [ ] Optional HTTP API: `POST /api/mission/start`, `GET /api/mission/status` (SSE or
      polling for streamed events)
- [ ] Tests for CLI lifecycle transitions (start → running → done/error)

### 2.6 Reproducibility guard — `scripts/verify-claims.mjs`
- [ ] Re-derives every headline metric the harness reports from committed artifacts under
      `./bench` (JSON) — never trusts a cached number
- [ ] Exits non-zero if any number can't be reproduced
- [ ] Wire as `bun run verify-claims` and a git pre-push hook (`.githooks/pre-push`)
- [ ] Principle to enforce in code, not just docs: a claim that can't be reproduced doesn't
      ship — this script is the enforcement point

### 2.7 Health check — `scripts/doctor.mjs`
- [ ] Verifies Bun/Node version, that a configured provider is reachable (or a local model
      is up), required tools exist on `PATH`, and config loads without exposing secrets
- [ ] Human-readable ✅/❌ output; non-zero exit on any failure
- [ ] Wire as `bun run doctor`

### `package.json` scripts to add this phase
```json
{
  "scripts": {
    "dev": "tsx src/cli.ts",
    "doctor": "bun scripts/doctor.mjs",
    "verify-claims": "bun scripts/verify-claims.mjs",
    "verify-finding": "bun scripts/verify-finding.mjs"
  }
}
```

## Definition of done

- [ ] `bun test` green, including all fake-approver and refuter test paths
- [ ] `bun run doctor` green in a clean environment
- [ ] At least two Loadouts registered, sharing the loop, differing only in tools/prompts
- [ ] An end-to-end mission produces a finding, the finding survives (or is retracted by)
      the refuter, and `bun run verify-claims` reproduces the reported result
- [ ] A fail-safe-deny test: an unattended run attempting a `dangerous`-tier tool with no
      approver wired is denied, and this is asserted in CI, not just observed manually
