# Deployment plans — index

**Branch:** `docs/deployment-plans`  
**Authored:** 2026-07-15  
**Baseline:** `main` @ merge of root `veritas` CLI (`0c779af`), cross-checked against `docs/`, `agents/plans/`, `THOR.md`, `CLAUDE.md`, and live harness source under `harness/`.  
**Companion (not yet on main):** `feat/v0.3-api-jobs-postgres` — HTTP job API, SSE, Postgres event sink / session retention.

This folder is the **deployment-facing** plan set. It does not replace `docs/OPERATIONS_PLAN.md` or `docs/PHASE2_MODAL_EXECUTION.md`; it analyses what is actually shipped today, what production observability still lacks, and what must exist (by category) to run locally in Docker and remotely on Modal.

| Doc | Purpose |
|-----|---------|
| [00-architecture-baseline.md](./00-architecture-baseline.md) | Architecture distilled from docs + code: planes, seams, deploy-relevant surfaces |
| [01-observability-production-gaps.md](./01-observability-production-gaps.md) | What logs/metrics/traces exist vs what production still needs |
| [02-docker-local-categories.md](./02-docker-local-categories.md) | Required elements for local Docker Container deployment, by category |
| [03-modal-remote-categories.md](./03-modal-remote-categories.md) | Required elements for remote Modal deployment, by category |
| [04-matrix.md](./04-matrix.md) | Side-by-side Docker ↔ Modal checklist + recommended build order |

## Canonical external docs (read first)

| Concern | Canonical source |
|---------|------------------|
| Ops / Docker / Modal narrative | `docs/OPERATIONS_PLAN.md` §6–§8 |
| Modal design (single SoT) | `docs/PHASE2_MODAL_EXECUTION.md` |
| Earlier Modal drafts (superseded) | `docs/STATIC_DEPLOYMENT.md` Approach B |
| Observability contract | `docs/OBSERVABILITY_STACK.md` (+ W4 land status in `docs/veritas-v0.2.md`) |
| 0.2 boundary / sequencing | `agents/plans/PHASE2.md` |
| Eight-plane philosophy | `THOR.md`, `agents/docs/eight-plane-harness-architecture-doc.md` |

## Non-negotiables that every deploy path must preserve

1. Scope before action  
2. Fail-safe deny (unattended → gated tools denied)  
3. Provenance before claim  
4. Refute before confirm  
5. Human before consequence  
6. Reproduce before report (`verify-claims`)  
7. Honest decomposition  
8. Compose, don't fork  

Deployment packaging must never bypass these — containerization is not a safety gate.
