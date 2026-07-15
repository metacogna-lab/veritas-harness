/**
 * Session lifecycle + dev retention (Feature 4).
 *
 * Every boot opens a session row. When ENVIRONMENT=dev, `applyRetention` purges all
 * rows belonging to PRIOR sessions — "retain only the work completed for the session"
 * — while always keeping the current one. In any other environment it is a no-op, so
 * production history accumulates.
 */
import { ne } from "drizzle-orm";
import type { Db } from "./db.ts";
import { sessions, missions, events, logs, jobs } from "./schema.ts";

/** Resolve the effective environment string (default "prod"). */
export function environment(env: NodeJS.ProcessEnv = process.env): string {
  return env.ENVIRONMENT ?? "prod";
}

/** Insert a session row for this boot and return its id. */
export async function startSession(db: Db, env: string): Promise<string> {
  const [row] = await db.insert(sessions).values({ environment: env }).returning({ id: sessions.id });
  if (!row) throw new Error("startSession: failed to create session row");
  return row.id;
}

/**
 * Dev retention: when env==="dev", delete every row (events, logs, missions, jobs,
 * and old session rows) that does NOT belong to `currentSessionId`. No-op otherwise.
 * The current session's data is always retained.
 */
export async function applyRetention(db: Db, env: string, currentSessionId: string): Promise<void> {
  if (env !== "dev") return;
  await db.delete(events).where(ne(events.sessionId, currentSessionId));
  await db.delete(logs).where(ne(logs.sessionId, currentSessionId));
  await db.delete(missions).where(ne(missions.sessionId, currentSessionId));
  await db.delete(jobs).where(ne(jobs.sessionId, currentSessionId));
  await db.delete(sessions).where(ne(sessions.id, currentSessionId));
}
