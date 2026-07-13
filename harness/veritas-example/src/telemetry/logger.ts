/**
 * StructuredLogger — subscribes to the EventBus and appends one NDJSON line per
 * event to a run-scoped file (W4). Each line: { t, lvl, ...event }. Append-only,
 * flat, ~one level deep. Never logs raw tool output or model completions.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { EventBus } from "./bus.ts";
import { EVENT_LEVEL, type HarnessEvent } from "./types.ts";

export interface LoggerOptions {
  /** NDJSON output path (e.g. .veritas/runs/<id>/events.ndjson). */
  file: string;
  /** Also mirror lines to stdout. Default false. */
  stdout?: boolean;
  /** Injectable clock for deterministic tests. */
  now?: () => string;
}

export class StructuredLogger {
  private readonly file: string;
  private readonly stdout: boolean;
  private readonly now: () => string;

  constructor(opts: LoggerOptions) {
    this.file = opts.file;
    this.stdout = opts.stdout ?? false;
    this.now = opts.now ?? (() => new Date().toISOString());
    mkdirSync(dirname(this.file), { recursive: true });
  }

  /** Serialize one event as a single NDJSON line. */
  format(event: HarnessEvent): string {
    return JSON.stringify({ t: this.now(), lvl: EVENT_LEVEL[event.kind], ...event });
  }

  /** Write one event. Non-throwing: a logging failure must not break the mission. */
  write(event: HarnessEvent): void {
    const line = this.format(event);
    try {
      appendFileSync(this.file, line + "\n", "utf8");
      if (this.stdout) process.stdout.write(line + "\n");
    } catch {
      // swallow — telemetry is best-effort
    }
  }

  /** Subscribe to a bus. Returns the unsubscribe function. */
  attach(bus: EventBus): () => void {
    return bus.on((event) => this.write(event));
  }
}
