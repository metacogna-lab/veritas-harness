/**
 * Server dependency injection (Feature 1). `createApp` takes these so routes are
 * unit-testable via app.request(...) with a scripted LLM, an in-memory store, and no
 * database — while production wires the real ControlPlane, config, and Postgres.
 */
import type { LLMBackbone } from "../llm/index.ts";
import type { MissionStore } from "../control/store.ts";
import type { HarnessConfig } from "../config/index.ts";
import type { EventBus } from "../telemetry/index.ts";
import type { Db } from "../persistence/db.ts";

/**
 * Minimal async-job surface the API needs (Feature 2 implements it). Declared here so
 * Feature 1 has no forward dependency on the jobs module and stays independently green.
 */
export interface JobEnqueuer {
  enqueueMission(spec: { planPath?: string; plan?: unknown }): Promise<{ id: string }>;
  get(id: string): Promise<unknown | undefined>;
  list(status?: string): Promise<unknown[]>;
  enqueue(type: string, spec: unknown): Promise<{ id: string }>;
}

export interface ServerDeps {
  /** Build an LLM from the active provider chain (provider-dependent behaviour). */
  buildLLM: () => LLMBackbone;
  /** Mission snapshot store (status/report). */
  store: MissionStore;
  /** Loaded harness config (provider identity surfaced by /health, /v1/provider). */
  config: HarnessConfig;
  /** Where ingested plans are written (missions/). */
  missionsDir: string;
  /** Optional telemetry bus shared with missions + SSE. */
  bus?: EventBus;
  /** Optional Postgres db (health check + job queue). */
  db?: Db;
  /** Optional job queue (Feature 2) for async missions + /v1/jobs. */
  queue?: JobEnqueuer;
  /** Current session id (for enqueuing jobs). */
  sessionId?: string;
}
