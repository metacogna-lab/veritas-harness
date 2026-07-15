# Architecture validation — Veritas ingest → evaluate → mission

**Date:** 2026-07-15  
**Sources:** `harnesses.json`, `agents/plans/` (+ `archive/`), `docs/veritas-v0.2.md`, harness source.

## Verdict

The mental model **"ingest project info → spawn harness → evaluate → complete missions"** is
**partly right**. The implemented product path is:

```
intention → ingest → research-plan.json → dogma eval → start --plan → findings (+ experience)
```

inside the **registered** harness `veritas-example`. Creating a **new** harness is a separate
meta operation (`create-harness` / `--from-spec`). Remote **Modal** spawn is scaffolded via
`SandboxProvider` (`SANDBOX_PROVIDER=modal`) but not fully live without Modal tokens/SDK wiring.

## Registry

| # | Name | Role |
|---|------|------|
| 1 | `veritas-research` | Pure 8-plane template (empty loadouts by default) |
| 2 | `veritas-example` | Research domain: ingest, eval, digest, missions, RSI, HTTP serve, sandboxes |

SoT: [`harnesses.json`](../harnesses.json). New harnesses only via `bun run create-harness`.

## Flow map

| Claim | Status | Where |
|-------|--------|-------|
| Ingest project information | **Yes** | CLI `ingest`, app UI, `core/` contracts |
| Spawn the harness | **Meta only** | `create-harness` / H-4 `--from-spec` LoadoutRegistry codegen |
| Evaluate (dogma / candidate) | **Yes** | `eval`, ingest gate; RSI `verify-harness-candidate` |
| Complete missions | **Yes (local)** | `start --plan`, `ControlPlane`; HTTP `/v1/missions` on v0.3 serve |
| Spawn mission sandbox | **Local+Docker yes; Modal skeleton** | `src/sandbox/*`, `SANDBOX_PROVIDER` |

## Safety invariants that still hold

1. Scope before action  
2. Fail-safe deny when unattended  
3. Provenance before claim  
4. Refute before confirm  
5. **Human before consequence** — RSI never auto-applies ([ADR 001](./adr/001-rsi-no-auto-apply.md))  
6. Reproduce before report (`verify-claims`)  
7. Honest decomposition  
8. Compose, don't fork (Loadouts)

## Plan archive

Completed phase plans live under [`agents/plans/archive/`](../agents/plans/archive/).  
Living risk/register items remain in `agents/plans/06-risk-register.md` when present.

## Remaining gaps (honest)

- ModalProvider live SDK `sandboxes.create` path still needs a Modal account + `bun add modal` finish.
- Optional HTTP auth before non-localhost exposure (risk register).
- Goal-loop (`POST /v1/goals`) from Phase 3.0 not required for sandbox provider MVP.
