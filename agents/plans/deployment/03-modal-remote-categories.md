# 03 — Remote Modal: required elements by category

**Date:** 2026-07-15  
**Status:** **NOT IMPLEMENTED** — no `modal/` package on main.  
**Canonical design:** `docs/PHASE2_MODAL_EXECUTION.md` + `docs/OPERATIONS_PLAN.md` §7  
**Do not build:** superseded `STATIC_DEPLOYMENT.md` Approach B (`debian_slim` + `modal_app.py`).

---

## Why Modal (deploy lens)

| Need | Modal fit |
|------|-----------|
| Ephemeral, billed compute per mission | `@app.function` per run / subtask |
| Same Bun image as Docker | `modal.Image.from_dockerfile("harness/veritas-example/Dockerfile")` (DRY) |
| Durable artifacts | `modal.Volume` (`veritas-missions`) |
| Secrets outside image | `modal.Secret.from_name("veritas")` |
| Optional schedule | `modal.Cron` for RSI dry-run / batch surveys |

**Prerequisite:** close observability P0 (always-on NDJSON + emit surface) so remote runs are not blind. W6 in `docs/veritas-v0.2.md` stays gated on W1–W5; W1–W5 are largely landed — W6 is the remaining deploy workstream.

---

## Category map

```
1. Account / SDK / workspace
2. Image & build
3. Secrets & config
4. Volumes & artifact layout
5. Functions / entrypoints
6. Observability & status
7. Compute / cost / timeouts
8. Safety & human gates
9. Local↔remote workflow
10. CI / deploy automation
11. Risks unique to Modal
```

---

## 1. Account / SDK / workspace

| Element | Required | Present | Gap |
|---------|----------|---------|-----|
| Modal account + workspace | yes | ❌ | Operator signup |
| Python env with `modal` SDK | `pip install modal` | ❌ | Pin version in `modal/requirements.txt` |
| `modal token` / CI secret | deploy auth | ❌ | GitHub Actions OIDC or token secret |
| App name | `veritas` (canonical) | design only | Avoid second app name (`veritas-example`) from superseded draft |

---

## 2. Image & build

| Element | Required | Present | Gap |
|---------|----------|---------|-----|
| Reuse harness Dockerfile | `Image.from_dockerfile(...)` | Docker exists; Modal glue ❌ | Ensure Dockerfile has **no mandatory CMD** conflict (Modal overrides) |
| Optional slim `Dockerfile.modal` | skip devDeps | ❌ | Size / cold-start optimization |
| git inside image | doctor / tooling | ✅ in current Dockerfile | Keep |
| Working directory `/app` | match Docker | ✅ | Pass `cwd="/app"` in subprocess |
| Cold start budget | ~5–10s acceptable | N/A | Optional pre-warm for interactive UI |

---

## 3. Secrets & config

| Element | Required | Present | Gap |
|---------|----------|---------|-----|
| Secret `veritas` | `ANTHROPIC_API_KEY`, `HARNESS_PROVIDER`, `HARNESS_MODEL` | ❌ | `modal secret create veritas …` |
| Default worker model | Haiku for cost (ops plan) | design | Override Sonnet per mission env |
| `VERITAS_RUNS_DIR` | point at Volume path | ❌ | Must be set in function env — ephemeral root FS loses runs otherwise |
| `LOG_STDOUT` / NDJSON path on Volume | remote debugging | ❌ | See observability category |
| Per-mission env | max steps, loadout | design | Pass as function args, not rebuilt secrets |

---

## 4. Volumes & artifact layout

Canonical layout (`PHASE2_MODAL_EXECUTION.md`):

```
/mnt/missions/
  <slug>/
    research-plan.json
    .veritas/runs/<id>/     # transcript, findings, status, events.ndjson
    experience/             # optional RSI archive
```

| Element | Required | Present | Gap |
|---------|----------|---------|-----|
| Volume `veritas-missions` | create_if_missing | ❌ | `modal volume create veritas-missions` |
| Mount map | `{ "/mnt/missions": vol }` | design | Implement in `modal/runner.py` |
| Append-only run dirs | never overwrite prior `<id>` | code already append-only | Enforce path = `/mnt/missions/<slug>/…` |
| Upload plan | local → volume | ❌ | `ingest_and_run.py` or `modal volume put` |
| Download artifacts | volume → local report | ❌ | `modal volume get` + local `bun run report` |
| Volume commit / reload | Modal FS semantics | ❌ | Call `vol.commit()` after harness exit if required by SDK version |

**Invariant #6:** `verify-claims` must run against Volume-backed artifacts (same container or downloaded tree) — never against truncated stderr.

---

## 5. Functions / entrypoints

| Element | Required | Present | Gap |
|---------|----------|---------|-----|
| `harness_run(plan_path) -> dict` | core M1 | ❌ | Subprocess: `bun run dev start --plan …` |
| Return shape | `{ exit, stderr_tail }` | design | Full transcript stays on Volume (last ~2k stderr only) |
| `ingest_and_run.py` | M3 one-shot | ❌ | Local ingest + spawn remote |
| `status.py` | M4 poller | ❌ | Read `status.json` from Volume for UI |
| Parallel fan-out | M5 / ADV | ❌ | One remote call per orchestrator subtask |
| Cron RSI dry-run | optional | design | Still human-gated apply |
| Timeouts | `timeout=3600` | design | Align with ControlPlane `maxSteps` |

---

## 6. Observability & status

| Element | Required | Present | Gap |
|---------|----------|---------|-----|
| NDJSON on Volume | primary remote log | blocked by CLI opt-in | Force always-on path under `/mnt/missions/.../events.ndjson` |
| Modal platform logs | function stdout/stderr | automatic once implemented | Keep secrets redacted |
| Status file | `status.json` for polling | mission store exists | Ensure path on Volume; write heartbeat / end status |
| No SSE from Modal by default | poll 5–10s | app stub only | Wire UI → `status.py` or HTTP bridge later |
| Metrics / OTLP from sandbox | optional | ❌ | Export via Volume shipper or OTLP sidecar pattern later |
| Correlation | `missionId` + Modal `call_id` | ❌ | Log both at function start |

Remote deploys inherit **all** gaps in [01-observability-production-gaps.md](./01-observability-production-gaps.md), magnified by truncated return payloads.

---

## 7. Compute / cost / timeouts

| Element | Required | Present | Gap |
|---------|----------|---------|-----|
| Memory | 2048 MiB baseline | design | Raise for large digests |
| CPU / concurrency | Modal account limits | ❌ | Cap orchestrator fan-out |
| Token runaway | `maxSteps` + function timeout | partial (maxSteps in CLI) | Pass `--max-steps` from runner |
| Cost defaults | Haiku workers | design | Document $/mission estimates post-pilot |
| Idempotency | re-spawn must not clobber | ❌ | Run id in path |

---

## 8. Safety & human gates

| Element | Required | Present | Gap |
|---------|----------|---------|-----|
| Invariant #2 | no approver in Modal → deny gated tiers | ✅ if unattended | Document explicitly in runner README |
| Invariant #5 | `requireHumanRelease` → PENDING exit | ✅ in harness | Runner must not treat PENDING as failure-to-ignore |
| Invariant #6 | verify on Volume artifacts | ❌ automation | Post-hook in function or CI job |
| Invariant #7 | honest subtask text on fan-out | code | Tests must cover Modal-spawned workers when M5 lands |
| Secret leakage | redact + Modal private logs | redact ✅ | Ban printing env in runner |

---

## 9. Local↔remote workflow

Canonical flow:

```
1. LOCAL   bun run ingest …          → missions/<slug>/research-plan.json
2. LOCAL   python modal/ingest_and_run.py --plan …
3. MODAL   harness_run(plan_path)
4. LOCAL   python modal/status.py --slug …
5. LOCAL   volume get + bun run report <id>
```

| Element | Required | Present | Gap |
|---------|----------|---------|-----|
| Path translation | host `missions/` ↔ `/mnt/missions/` | ❌ | Convention table in runner docs |
| Root `veritas` CLI | local only | ✅ meta | Does not deploy to Modal by itself |
| App handoff | write plan then spawn | H-1 planPath | Need Modal trigger from API/UI (post v0.3) |

---

## 10. CI / deploy automation

| Element | Required | Present | Gap |
|---------|----------|---------|-----|
| `modal deploy modal/runner.py` | ship functions | ❌ | GHA on main tags |
| Smoke `modal run … harness_run` | with fixture plan | ❌ | Uses CI secret + disposable volume prefix |
| Image rebuild on Dockerfile change | Modal build cache | ❌ | Document invalidate strategy |
| Block deploy if `verify-claims` fails | gate | partial local | Add remote artifact check job |

---

## 11. Risks unique to Modal

| Risk | Mitigation (must be in runner design) |
|------|----------------------------------------|
| Ephemeral container FS | All durable writes under Volume via `VERITAS_RUNS_DIR` |
| Truncated stderr return | Never treat return dict as evidence; Volume is SoT |
| Cold start | Accept for research; pre-warm only if UI-interactive |
| Volume races | One writer per `missionId`; no shared mutable status without locking |
| Conflicting old designs | Implement **only** `PHASE2_MODAL_EXECUTION.md` shapes |
| Observability blind spot | Block “production Modal” until observability P0 exits |

---

## Milestones (unchanged, still open)

| # | Deliverable | Depends on |
|---|-------------|------------|
| M1 | `modal/runner.py` + `harness_run` | Docker image stable |
| M2 | Volume wired + `VERITAS_RUNS_DIR` | M1 |
| M3 | `ingest_and_run.py` | M2 |
| M4 | `status.py` (+ UI poll) | M2 |
| M5 | Orchestrator fan-out | ADV orchestration + M1 |

---

## Exit criteria (Modal “ready”)

- [ ] Single canonical `modal/` tree matching PHASE2 design  
- [ ] Secret + Volume created; Dockerfile reused  
- [ ] One remote mission leaves full artifact tree on Volume  
- [ ] Status poller returns running/done/error without local compute  
- [ ] Structured NDJSON present on Volume for that mission  
- [ ] Unattended gated tools denied; human-release PENDING handled  
- [ ] `verify-claims` greened on downloaded or mounted artifacts  
