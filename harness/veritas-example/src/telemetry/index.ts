/**
 * Telemetry stack entry point (W4). Re-exports the pieces and wires a bus+logger
 * from the environment. Telemetry is OPT-IN and zero-cost when unconfigured: with no
 * LOG_FILE (and no explicit path) `telemetryFromEnv` returns undefined and the control
 * plane emits nothing. This keeps the default mission path byte-for-byte unchanged.
 */
import { join } from "node:path";
import { EventBus } from "./bus.ts";
import { StructuredLogger } from "./logger.ts";
import { PgSink } from "./pg-sink.ts";
import type { Db } from "../persistence/db.ts";

export { EventBus } from "./bus.ts";
export { StructuredLogger } from "./logger.ts";
export { PgSink } from "./pg-sink.ts";
export { readEvents, filterEvents, summarise } from "./reader.ts";
export type { HarnessEvent, HarnessEventKind, MissionMetrics } from "./types.ts";
export { EVENT_LEVEL } from "./types.ts";

export interface Telemetry {
  bus: EventBus;
  /** Detach the subscribers and drop listeners. Call at mission close. */
  detach: () => void;
}

/** Optional Postgres persistence for telemetry (Feature 4). */
export interface PgTelemetryOptions {
  db: Db;
  sessionId: string;
}

/**
 * Build a telemetry bus + subscribers, honoring env:
 *   LOG_FILE     explicit NDJSON path (overrides runDir default)
 *   LOG_STDOUT   mirror lines to stdout when "true"
 *   PG_TELEMETRY set "false" to disable the Postgres sink even when a db is passed
 *
 * A bus is created when EITHER an NDJSON file target OR a Postgres sink is available,
 * so an API/worker with a db but no LOG_FILE still gets persisted telemetry. Returns
 * undefined only when neither sink is configured (zero-cost default path unchanged).
 */
export function telemetryFromEnv(runDir?: string, pg?: PgTelemetryOptions): Telemetry | undefined {
  const file = process.env.LOG_FILE ?? (runDir ? join(runDir, "events.ndjson") : undefined);
  const pgEnabled = Boolean(pg) && process.env.PG_TELEMETRY !== "false";
  if (!file && !pgEnabled) return undefined;

  const bus = new EventBus();
  const unsubscribers: Array<() => void> = [];

  if (file) {
    const logger = new StructuredLogger({ file, stdout: process.env.LOG_STDOUT === "true" });
    unsubscribers.push(logger.attach(bus));
  }
  if (pgEnabled && pg) {
    const sink = new PgSink(pg.db, pg.sessionId);
    unsubscribers.push(sink.attach(bus));
  }

  return {
    bus,
    detach: () => {
      for (const off of unsubscribers) off();
      bus.clear();
    },
  };
}
