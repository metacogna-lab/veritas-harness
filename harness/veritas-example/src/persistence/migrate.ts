/**
 * Idempotent schema bootstrap (Feature 4).
 *
 * Runs `CREATE TABLE IF NOT EXISTS` DDL matching schema.ts so the API server / job
 * runner can migrate on boot with no external drizzle-kit CLI step. Safe to run on
 * every startup and in tests (idempotent by construction).
 */
import postgres from "postgres";
import { databaseUrl } from "./db.ts";

const DDL = `
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE TABLE IF NOT EXISTS missions (
  id text PRIMARY KEY,
  session_id uuid NOT NULL,
  slug text,
  objective text,
  status text,
  snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS missions_session_idx ON missions (session_id);

CREATE TABLE IF NOT EXISTS events (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL,
  mission_id text,
  kind text NOT NULL,
  level text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_mission_idx ON events (mission_id);
CREATE INDEX IF NOT EXISTS events_kind_idx ON events (kind);
CREATE INDEX IF NOT EXISTS events_session_idx ON events (session_id);

CREATE TABLE IF NOT EXISTS logs (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL,
  mission_id text,
  level text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS logs_session_idx ON logs (session_id);

CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  type text NOT NULL,
  spec jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  result jsonb,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status);
CREATE INDEX IF NOT EXISTS jobs_session_idx ON jobs (session_id);
`;

/**
 * Create all tables + indexes if absent. Opens a short-lived connection so it can be
 * called before the shared pool is built. Idempotent.
 */
export async function runMigrations(url?: string): Promise<void> {
  const sql = postgres(url ?? databaseUrl(), { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(DDL);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
