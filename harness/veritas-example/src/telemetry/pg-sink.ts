/**
 * PgSink (Feature 4) — a second EventBus subscriber that persists every HarnessEvent
 * to Postgres, alongside the NDJSON StructuredLogger.
 *
 * NON-THROWING by contract, exactly like StructuredLogger: a database failure must
 * never break a mission. Inserts are fire-and-forget; a rejected promise is caught and
 * turned into a one-line stderr warning. Ordering within a mission is preserved by the
 * events table's bigserial id, not by await-ing each insert.
 */
import type { EventBus } from "./bus.ts";
import type { HarnessEvent } from "./types.ts";
import type { Db } from "../persistence/db.ts";
import { insertEvent } from "../persistence/repo.ts";

export class PgSink {
  private warned = false;

  constructor(
    private readonly db: Db,
    private readonly sessionId: string,
  ) {}

  private write(event: HarnessEvent): void {
    // Fire-and-forget; never let a DB error propagate into the mission loop.
    void insertEvent(this.db, this.sessionId, event).catch((err) => {
      if (!this.warned) {
        this.warned = true;
        process.stderr.write(`pg-sink: warn — event persistence failing (${(err as Error).message})\n`);
      }
    });
  }

  /** Subscribe to a bus. Returns the unsubscribe function. */
  attach(bus: EventBus): () => void {
    return bus.on((event) => this.write(event));
  }
}
