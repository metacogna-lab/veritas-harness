# 02 — Local Docker Container: required elements by category

**Date:** 2026-07-15  
**Primary target image:** `harness/veritas-example`  
**Already present on main:** `Dockerfile`, `.dockerignore`, `docker-compose.yml` (CLI service only — no Postgres).  
**Canonical narrative:** `docs/OPERATIONS_PLAN.md` §6, `docs/STATIC_DEPLOYMENT.md` Approach A.

---

## Category map

```
1. Runtime / image
2. Configuration & secrets
3. Persistent state (volumes)
4. Networking & egress
5. Process lifecycle & health
6. Observability inside the container
7. Safety / identity / permissions
8. Missions workflow (operator UX)
9. CI / verification
10. Optional: API + Postgres (v0.3 overlay)
```

Each category lists **Required**, **Present**, and **Gap**.

---

## 1. Runtime / image

| Element | Required | Present | Gap |
|---------|----------|---------|-----|
| Bun runtime base | `oven/bun` multi-stage | ✅ Dockerfile stages `deps` + runtime | Pin digest/tag for reproducible builds (`oven/bun:<version>@sha256:…`) |
| Frozen install | `bun install --frozen-lockfile` | ✅ deps stage | Ensure `bun.lock` always copied with `package.json` |
| git on PATH | doctor / mission tooling | ✅ apt install git | Keep `--no-install-recommends` |
| Headless CLI entry | `ENTRYPOINT bun run dev` | ✅ | Document root `veritas` is **outside** this image unless meta root is packaged |
| Non-root user | production UID | ❌ runs as image default (root) | Add `USER` + writable dirs for volumes |
| Image scan / SBOM | supply-chain | ❌ | CI: Trivy/Grype + lockfile audit |
| Separate prod image | no devDeps if desired | ❌ single install | Optional slim stage (aligns with planned `Dockerfile.modal`) |

---

## 2. Configuration & secrets

| Element | Required | Present | Gap |
|---------|----------|---------|-----|
| Runtime env injection | `--env-file` / compose `env_file` | ✅ compose uses `.env` | Ship `.env.example` in harness (keys only) |
| Provider keys | `ANTHROPIC_API_KEY` (+ others) | docs only | Never COPY `.env*` / `local.json` (✅ `.dockerignore`) |
| Model overrides | `HARNESS_PROVIDER`, `HARNESS_MODEL` | supported by config | Document compose `environment:` overrides |
| Runs dir override | `VERITAS_RUNS_DIR` | supported | Default `.veritas/runs` OK with volume |
| Config wizard | `veritas-config` | script exists | Interactive wizard is awkward in CI containers — prefer env |
| Secret manager hook | Docker Desktop / Swarm / K8s secrets | ❌ local-only `.env` | Document mapping for non-dev hosts |

---

## 3. Persistent state (volumes)

| Element | Required | Present | Gap |
|---------|----------|---------|-----|
| Mission runs | named vol → `/app/.veritas` | ✅ `veritas-runs` | Confirm UID write access after non-root |
| Plans | bind `./missions` → `/app/missions` | ✅ | Host path must exist before first run |
| Experience / lessons | named vol → `/app/resources/experience` | ✅ `veritas-experience` | Also persist `lessons.json` (same tree or explicit file mount) |
| Ephemeral OK | `node_modules`, `build`, digests | rebuilt in image | Do not mount over `/app` wholesale |
| Backup / export | snapshot volumes for invariant #6 | ❌ | Document `docker run` tar of volumes + `verify-claims` |

---

## 4. Networking & egress

| Element | Required | Present | Gap |
|---------|----------|---------|-----|
| Outbound HTTPS to LLM providers | default bridge | implicit | Document corporate proxy / `NO_PROXY` needs |
| Scope gate still authoritative | hosts/paths in plan | ✅ code | Do not widen Docker network policy as “extra scope” |
| Optional inbound API | only if serving HTTP | ❌ on main compose | See category 10 (v0.3) |
| DNS / private ranges | safety denies loopback/private by default | ✅ | Local Ollama may need explicit scope + `host.docker.internal` guidance |

---

## 5. Process lifecycle & health

| Element | Required | Present | Gap |
|---------|----------|---------|-----|
| HEALTHCHECK | `bun run doctor` | ✅ | Doctor may fail without key — decide soft vs hard health |
| One-shot mission | `docker compose run --rm veritas start …` | ✅ pattern | Add/restore `scripts/docker-mission.sh` if missing on main |
| Max runtime | compose/K8s timeout | ❌ | Recommend `--timeout` / orchestrator job deadline (align with Modal 3600s) |
| Restart policy | never for one-shot CLI | N/A | Use `restart: "no"` if long-running API later |
| Graceful shutdown | SIGTERM → flush logs | ❌ sync logger only | Flush/detach telemetry on signal |

---

## 6. Observability inside the container

| Element | Required | Present | Gap |
|---------|----------|---------|-----|
| `LOG_FILE` → volume path | always-on NDJSON | ❌ opt-in only | Set in compose: `LOG_FILE=/app/.veritas/runs/_active/events.ndjson` **or** fix CLI to pass runDir |
| `LOG_STDOUT=true` | scavengable by `docker logs` | ❌ | Add to compose `environment` |
| Mission id in stdout | correlate `docker logs` | partial human lines | Structured lines after observability P0/P1 |
| Metrics file | `metrics.json` per run | ❌ | Blocked on MetricsCollector |
| Log driver | json-file / loki | host default | Document rotation (`max-size`) for long hosts |
| Doctor as preflight | before `start` | manual | Wrapper script: doctor → start |

See [01-observability-production-gaps.md](./01-observability-production-gaps.md).

---

## 7. Safety / identity / permissions

| Element | Required | Present | Gap |
|---------|----------|---------|-----|
| Fail-safe deny unattended | no approver in container | ✅ invariant #2 | Document: Docker does not grant auto-approval |
| Human-release for RSI apply / terminal | stays PENDING | ✅ | Operators apply on host, not blind in container |
| Read-only root FS | optional harden | ❌ | Pair with writable volumes only |
| Drop Linux caps | production harden | ❌ | Compose `cap_drop: [ALL]` + needed adds |
| Resource limits | memory/CPU | ❌ | Compose `deploy.resources` / `mem_limit` |

---

## 8. Missions workflow (operator UX)

| Element | Required | Present | Gap |
|---------|----------|---------|-----|
| Ingest on host or in container | produce `missions/<slug>/` | host pattern documented | Container ingest needs write to bind mount |
| `start --plan /app/missions/...` | absolute in-container path | docs | Avoid relative host paths inside container |
| `status` / `report` | read runs volume | works if same volume | Session affinity: same compose project name |
| Bench / verify-claims | CI or post-run | scripts exist | Optional compose `profiles: [verify]` service |
| Root launcher | `veritas` from meta | not in harness image | Keep meta commands on host; image stays harness-scoped |

---

## 9. CI / verification

| Element | Required | Present | Gap |
|---------|----------|---------|-----|
| `bun test` + `verify-claims` + `bench` | gate image quality | docs snippet | Wire GHA job that **builds** image and runs `doctor` |
| Image build cache | BuildKit | local | CI cache mounts for `bun install` |
| No secrets in layers | history scan | `.dockerignore` | Add CI check for accidental key files |
| Smoke: `compose run loadouts` | safe no-op CMD | ✅ default CMD | Keep as default |

---

## 10. Optional overlay — API + Postgres (from v0.3)

When/if `feat/v0.3-api-jobs-postgres` merges, local Docker gains:

| Element | Role |
|---------|------|
| `postgres:16` service | sessions, events, logs, jobs |
| `DATABASE_URL` | harness → drizzle |
| `ENVIRONMENT=dev|prod` | retention purge semantics |
| HTTP server entry | replace/extend `CMD` to `bun src/server/index.ts` |
| SSE + job enqueue | UI/STEP 2 without Modal |
| `PgSink` | EventBus durability beyond volume NDJSON |

**Do not** pretend this is on main today — track as a compose profile `api` once merged.

---

## Minimal local compose profile (target state)

```yaml
# illustrative target — not yet committed as-is
services:
  veritas:
    build: .
    env_file: .env
    environment:
      LOG_STDOUT: "true"
      # After CLI fix: telemetry always writes under VERITAS_RUNS_DIR
      VERITAS_RUNS_DIR: /app/.veritas/runs
    volumes:
      - ./missions:/app/missions
      - veritas-runs:/app/.veritas
      - veritas-experience:/app/resources/experience
    mem_limit: 2g
```

Operator loop:

```bash
cd harness/veritas-example
echo "ANTHROPIC_API_KEY=…" > .env
docker compose build
docker compose run --rm veritas doctor
# ingest on host (or in-container with missions mount)
docker compose run --rm veritas start --plan /app/missions/<slug>/research-plan.json
```

---

## Exit criteria (Docker local “ready”)

- [ ] Non-root user + volumes writable  
- [ ] Secrets only via env; image builds reproducibly from lockfile  
- [ ] Three persist volumes documented and backed up  
- [ ] Always-on structured logs to volume + `docker logs`  
- [ ] Doctor + one mission smoke in CI  
- [ ] Safety invariants verified unattended (gated tools denied)  
- [ ] `verify-claims` runnable against volume artifacts  
