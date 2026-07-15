/**
 * drizzle-kit config (Feature 4). Optional tooling for generating SQL migrations from
 * src/persistence/schema.ts. Runtime bootstrap uses src/persistence/migrate.ts
 * (idempotent CREATE TABLE IF NOT EXISTS), so this is for `drizzle-kit generate`/studio
 * during development, not required at container start.
 */
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/persistence/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://veritas:veritas@localhost:5432/veritas",
  },
} satisfies Config;
