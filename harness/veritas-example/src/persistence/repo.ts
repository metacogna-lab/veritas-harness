/**
 * Repository layer (Feature 4) — typed reads/writes over the Drizzle db.
 *
 * All writes redact secrets before insert. `listEventsByMission` returns HarnessEvent[]
 * so the RSI/telemetry reader path has PARITY with the NDJSON reader (summarise() over
 * either source yields the same MissionMetrics).
 */
import { eq } from "drizzle-orm";
import type { Db } from "./db.ts";
import { events, missions, logs } from "./schema.ts";
import { redact } from "../config/redact.ts";
import { EVENT_LEVEL, type HarnessEvent } from "../telemetry/types.ts";
import type { MissionSnapshot } from "../mission/types.ts";

/** Insert one telemetry event (payload redacted). Returns nothing; callers stay fire-and-forget. */
export async function insertEvent(db: Db, sessionId: string, e: HarnessEvent): Promise<void> {
  const missionId = "missionId" in e ? e.missionId : null;
  await db.insert(events).values({
    sessionId,
    missionId: missionId ?? null,
    kind: e.kind,
    level: EVENT_LEVEL[e.kind],
    payload: redact(e) as Record<string, unknown>,
  });
}

/** Upsert a mission snapshot (redacted) keyed by mission id. */
export async function upsertMission(db: Db, sessionId: string, snap: MissionSnapshot): Promise<void> {
  const redacted = redact(snap) as MissionSnapshot;
  const row = {
    id: snap.id,
    sessionId,
    slug: null as string | null,
    objective: redacted.objective ?? null,
    status: redacted.status ?? null,
    snapshot: redacted as unknown as Record<string, unknown>,
    updatedAt: new Date(),
  };
  await db
    .insert(missions)
    .values(row)
    .onConflictDoUpdate({
      target: missions.id,
      set: { status: row.status, objective: row.objective, snapshot: row.snapshot, updatedAt: row.updatedAt },
    });
}

/** Insert a structured log line (message redacted). */
export async function insertLog(
  db: Db,
  sessionId: string,
  missionId: string | null,
  level: string,
  message: string,
): Promise<void> {
  await db.insert(logs).values({ sessionId, missionId, level, message: redact(message) as string });
}

/** Read a mission's events back as HarnessEvent[] (parity with telemetry/reader.ts). */
export async function listEventsByMission(db: Db, missionId: string): Promise<HarnessEvent[]> {
  const rows = await db
    .select({ payload: events.payload })
    .from(events)
    .where(eq(events.missionId, missionId))
    .orderBy(events.id);
  return rows.map((r) => r.payload as unknown as HarnessEvent);
}
