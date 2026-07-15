/**
 * Database connection (Feature 4). Lazy postgres.js client wrapped by Drizzle.
 *
 * DATABASE_URL default targets a local `veritas` database. The pool is a process
 * singleton so the API server, job runner, and telemetry sink share one connection
 * set; `closeDb()` drains it for graceful shutdown and tests.
 */
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export type Db = PostgresJsDatabase<typeof schema>;

export const DEFAULT_DATABASE_URL = "postgres://veritas:veritas@localhost:5432/veritas";

let client: ReturnType<typeof postgres> | undefined;
let db: Db | undefined;

/** True when a database connection is configured (DATABASE_URL present). */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Resolve the connection string (env override → default). */
export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

/**
 * Get the shared Drizzle db (lazy). A caller may pass an explicit url for tests;
 * that produces the shared singleton only when it matches, otherwise a fresh handle
 * the caller owns.
 */
export function getDb(url?: string): Db {
  if (url) {
    const c = postgres(url, { max: 4, onnotice: () => {} });
    return drizzle(c, { schema });
  }
  if (!db) {
    client = postgres(databaseUrl(), { max: 8, onnotice: () => {} });
    db = drizzle(client, { schema });
  }
  return db;
}

/** Close the shared pool (graceful shutdown / test teardown). */
export async function closeDb(): Promise<void> {
  if (client) {
    await client.end({ timeout: 5 });
    client = undefined;
    db = undefined;
  }
}
