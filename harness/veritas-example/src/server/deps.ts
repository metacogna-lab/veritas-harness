/**
 * Server dependency injection (Feature 1). `createApp` takes these so routes are
 * unit-testable via app.request(...) with a scripted LLM, an in-memory store, and no
 * database — while production wires the real ControlPlane, config, and Postgres.
 */
import type { LLMBackbone } from "@spine/llm/index.ts";
import type { MissionStore } from "@spine/control/store.ts";
import type { HarnessConfig } from "@spine/config/index.ts";
import type { EventBus } from "../telemetry/index.ts";
import type { Db } from "../persistence/db.ts";
import type { JobQueue } from "../jobs/queue.ts";

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
  queue?: JobQueue;
  /** Current session id (for enqueuing jobs). */
  sessionId?: string;
}
