# 04 — Docker ↔ Modal matrix & build order

**Date:** 2026-07-15  
**Use:** Single checklist when choosing or sequencing deploy paths.

---

## 1. Side-by-side requirements

| Category | Local Docker | Remote Modal |
|----------|--------------|--------------|
| **Image** | Build `harness/veritas-example/Dockerfile` | Same Dockerfile via `Image.from_dockerfile` |
| **Secrets** | `.env` / compose `env_file` | `modal.Secret("veritas")` |
| **Durable state** | Named volumes + `./missions` bind | `modal.Volume("veritas-missions")` |
| **Entry** | `bun run dev <verb>` | `harness_run(plan_path)` → same CLI |
| **Status** | `bun run status` against local volume | `status.py` reads Volume `status.json` |
| **Logs** | `docker logs` + volume NDJSON | Modal logs + Volume NDJSON (stderr return is **not** SoT) |
| **Health** | Dockerfile `HEALTHCHECK` / doctor | Function success + Volume artifact presence |
| **Cost model** | Host always on | Per-second function billing |
| **Best for** | Dev, CI, long audits | Scheduled / burst / fan-out |
| **Code on main** | Dockerfile + compose ✅ | `modal/` ❌ |

---

## 2. Shared production blockers (fix first)

These block **both** paths equally:

1. Telemetry off-by-default (`LOG_FILE` only) → empty ops signal in containers  
2. Missing emissions: steps, denials, provider errors, ingest gates  
3. No `metrics.json` / cost rollup  
4. No non-root container user (Docker) — carries into Modal image if not fixed  
5. Human channel logs can echo raw tool inputs without correlation IDs  

Track in [01-observability-production-gaps.md](./01-observability-production-gaps.md).

---

## 3. Recommended build order

```
1. Observability P0 (default NDJSON + emit step/deny/provider)
2. Docker harden (non-root, LOG_STDOUT, resource limits, CI image smoke)
3. Optional: merge v0.3 API/Postgres profile for long-lived local control plane
4. Modal M1–M2 (runner + Volume + VERITAS_RUNS_DIR)
5. Modal M3–M4 (ingest_and_run + status poller)
6. Observability P2 (OTLP and/or PgSink export) + alerts
7. Modal M5 (parallel fan-out) only after orchestration honesty tests stay green
```

Do **not** start Modal before (1) and a successful Docker mission with Volume-shaped paths proved locally (`VERITAS_RUNS_DIR` under a mount).

---

## 4. Category ownership (who fills the gap)

| Category | Primary owner surface |
|----------|------------------------|
| Image/runtime | `harness/veritas-example/Dockerfile` |
| Secrets | ops + `src/config/` env resolution |
| State | MissionStore + experience-store + Volume mounts |
| Observability | `src/telemetry/` + CLI wiring |
| Safety | `src/safety/*` (unchanged by deploy) |
| Control / entry | `src/cli.ts`, later `src/server/`, `modal/runner.py` |
| Meta packaging | root `meta/veritas.ts` (local only) |
| Verification | `scripts/verify-claims.mjs`, bench |

---

## 5. Doc upkeep (after implementation)

When code lands, update in one pass:

- `docs/OPERATIONS_PLAN.md` §8 — remove “telemetry not built” banner; link real emit list  
- `agents/plans/PHASE2.md` B5 — mark telemetry built + remaining emit/RSI-consume gaps  
- `docs/PHASE2_MODAL_EXECUTION.md` — flip Status to IMPLEMENTED + paths  
- This folder — check exit criteria boxes and add eval under `agents/evals/`

---

## 6. Explicit non-goals (this plan set)

- Kubernetes / ECS manifests (future; Docker categories still apply)  
- Multi-tenant SaaS auth for the control plane (open question in plan 06)  
- Auto-apply RSI in cloud (forbidden by invariant #5)  
- Building from superseded Modal Approach B sketches  
