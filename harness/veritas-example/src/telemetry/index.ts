/**
 * Telemetry stack entry point (W4). Re-exports the pieces and wires a bus+logger
 * from the environment. Telemetry is OPT-IN and zero-cost when unconfigured: with no
 * LOG_FILE (and no explicit path) `telemetryFromEnv` returns undefined and the control
 * plane emits nothing. This keeps the default mission path byte-for-byte unchanged.
 */
import { join } from "node:path";
import { EventBus } from "./bus.ts";
import { StructuredLogger } from "./logger.ts";

export { EventBus } from "./bus.ts";
export { StructuredLogger } from "./logger.ts";
export { readEvents, filterEvents, summarise } from "./reader.ts";
export type { HarnessEvent, HarnessEventKind, MissionMetrics } from "./types.ts";
export { EVENT_LEVEL } from "./types.ts";

export interface Telemetry {
  bus: EventBus;
  /** Detach the logger and drop subscribers. Call at mission close. */
  detach: () => void;
}

/**
 * Build a telemetry bus + NDJSON logger for a mission run directory, honoring env:
 *   LOG_FILE   explicit NDJSON path (overrides runDir default)
 *   LOG_STDOUT mirror lines to stdout when "true"
 *   LOG_LEVEL  reserved (all events currently written; filtering is a later step)
 * Returns undefined when telemetry is not enabled (no LOG_FILE and no runDir given).
 */
export function telemetryFromEnv(runDir?: string): Telemetry | undefined {
  const file = process.env.LOG_FILE ?? (runDir ? join(runDir, "events.ndjson") : undefined);
  if (!file) return undefined;

  const bus = new EventBus();
  const logger = new StructuredLogger({ file, stdout: process.env.LOG_STDOUT === "true" });
  const unsubscribe = logger.attach(bus);
  return {
    bus,
    detach: () => {
      unsubscribe();
      bus.clear();
    },
  };
}
