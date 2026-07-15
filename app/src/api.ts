import { useEffect, useState } from "react";

// The dashboard is a pure HTTP client of the veritas-example harness API.
// In dev, Vite proxies /v1 and /health to HARNESS_API_URL (default :8080).

export const API_BASE = import.meta.env.VITE_HARNESS_API_URL ?? "";

// ── Envelope handling ────────────────────────────────
// Every harness response is { ok: boolean, ... }. On !ok we throw the error.
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly body: unknown) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || body.ok === false) {
    throw new ApiError(
      (body.error as string) ?? `request failed (${res.status})`,
      res.status,
      body,
    );
  }
  return body as T;
}

// ── Types (mirrors src/mission, src/jobs, src/telemetry) ──
export type MissionStatus = "created" | "running" | "done" | "error";
export type JobStatus = "queued" | "running" | "done" | "error" | "held";

export interface Health {
  ok: true;
  status: string;
  db: boolean;
  provider: string;
  model: string;
  chain: { provider: string; model: string }[];
}
export interface Loadout {
  name: string;
  description: string;
}
export interface IngestDimension {
  name: string;
  score: number;
  [k: string]: unknown;
}
export interface IngestResult {
  ok: true;
  slug: string;
  planPath: string;
  score: number;
  dimensions: IngestDimension[];
  plan: unknown;
}
export interface Job {
  id: string;
  sessionId: string;
  type: "mission" | "ingest";
  spec: Record<string, unknown>;
  status: JobStatus;
  result?: unknown;
  error?: string;
  attempts: number;
  createdAt?: string;
  startedAt?: string;
  finishedAt?: string;
}

// A telemetry frame delivered over SSE. `kind` is the SSE event name.
export interface HarnessEvent {
  kind: string;
  missionId?: string;
  step?: number;
  tool?: string;
  riskTier?: string;
  tier?: string;
  status?: string;
  ok?: boolean;
  findingId?: string;
  reason?: string;
  objective?: string;
  slug?: string;
  durationMs?: number;
  [k: string]: unknown;
}

// ── Endpoints ────────────────────────────────────────
export const api = {
  health: () => call<Health>("/health"),
  provider: () => call<{ provider: string; model: string; chain: unknown[] }>("/v1/provider"),
  loadouts: () => call<{ loadouts: Loadout[] }>("/v1/loadouts").then((r) => r.loadouts),

  ingest: (body: { slug: string; objective: string; target?: string; loadout?: string }) =>
    call<IngestResult>("/v1/ingest", { method: "POST", body: JSON.stringify(body) }),

  createMission: (
    body: { objective?: string; target?: string; planPath?: string; loadout?: string; maxSteps?: number },
    async_ = false,
  ) =>
    call<{ id?: string; jobId?: string; status: string }>(
      `/v1/missions${async_ ? "?async=true" : ""}`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  mission: (id: string) => call<{ id: string; status: MissionStatus }>(`/v1/missions/${id}`),
  report: (id: string) => call<{ id: string; report: string }>(`/v1/missions/${id}/report`),

  createJob: (body: Record<string, unknown>) =>
    call<{ id: string; status: JobStatus }>("/v1/jobs", { method: "POST", body: JSON.stringify(body) }),
  jobs: (status?: JobStatus) =>
    call<{ jobs: Job[] }>(`/v1/jobs${status ? `?status=${status}` : ""}`).then((r) => r.jobs),
  job: (id: string) => call<{ job: Job }>(`/v1/jobs/${id}`).then((r) => r.job),
};

// All SSE event names the harness emits (EventSource has no catch-all).
export const EVENT_KINDS = [
  "mission.start", "mission.end", "step.execute", "step.observe",
  "tool.scope_deny", "tool.gate_deny", "finding.proposed",
  "finding.confirmed", "finding.refuted", "ingest.gate_pass",
  "ingest.gate_fail", "provider.error",
] as const;

// Open a live telemetry stream for a mission. Returns a close() fn.
export function openMissionStream(id: string, onEvent: (e: HarnessEvent) => void): () => void {
  const es = new EventSource(`${API_BASE}/v1/missions/${id}/events`);
  const handle = (kind: string) => (ev: MessageEvent) => {
    try {
      onEvent({ kind, ...(JSON.parse(ev.data) as object) });
    } catch {
      onEvent({ kind, raw: ev.data });
    }
    if (kind === "mission.end") es.close();
  };
  for (const kind of EVENT_KINDS) es.addEventListener(kind, handle(kind));
  es.addEventListener("message", handle("message"));
  return () => es.close();
}

// ── Hooks ────────────────────────────────────────────
export function useApiHealth() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let alive = true;
    const ping = () => api.health().then(() => alive && setOk(true)).catch(() => alive && setOk(false));
    ping();
    const t = setInterval(ping, 15_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return { ok, base: API_BASE || "localhost:8080 (proxied)" };
}

// Generic async loader with loading/error state.
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);
  return { data, error, loading, reload: () => setNonce((n) => n + 1) };
}
