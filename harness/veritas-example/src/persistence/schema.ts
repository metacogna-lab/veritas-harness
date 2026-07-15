/**
 * Drizzle schema for the `veritas` database (Feature 4).
 *
 * Persists telemetry (the HarnessEvent stream), structured logs, mission snapshots,
 * and (Feature 2) the job queue. Every row is tagged with a `session_id` so that
 * ENVIRONMENT=dev retention can purge everything but the current session at boot.
 *
 * jsonb columns (`payload`, `snapshot`, `spec`, `result`) hold already-redacted
 * structures — secrets are masked by redact() before they ever reach the repo layer.
 */
import { pgTable, uuid, text, timestamp, jsonb, bigserial, integer, index } from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  environment: text("environment").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const missions = pgTable(
  "missions",
  {
    id: text("id").primaryKey(),
    sessionId: uuid("session_id").notNull(),
    slug: text("slug"),
    objective: text("objective"),
    status: text("status"),
    snapshot: jsonb("snapshot"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index("missions_session_idx").on(t.sessionId),
  }),
);

export const events = pgTable(
  "events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sessionId: uuid("session_id").notNull(),
    missionId: text("mission_id"),
    kind: text("kind").notNull(),
    level: text("level").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    missionIdx: index("events_mission_idx").on(t.missionId),
    kindIdx: index("events_kind_idx").on(t.kind),
    sessionIdx: index("events_session_idx").on(t.sessionId),
  }),
);

export const logs = pgTable(
  "logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sessionId: uuid("session_id").notNull(),
    missionId: text("mission_id"),
    level: text("level").notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index("logs_session_idx").on(t.sessionId),
  }),
);

/**
 * Job queue (Feature 2). Declared here so the schema is one source of truth and the
 * dev-retention purge covers it. `status`: queued | running | done | error | held.
 */
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull(),
    type: text("type").notNull(),
    spec: jsonb("spec").notNull(),
    status: text("status").notNull().default("queued"),
    result: jsonb("result"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => ({
    statusIdx: index("jobs_status_idx").on(t.status),
    sessionIdx: index("jobs_session_idx").on(t.sessionId),
  }),
);

export type SessionRow = typeof sessions.$inferSelect;
export type MissionRow = typeof missions.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type LogRow = typeof logs.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
