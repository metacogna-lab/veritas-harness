/**
 * API server entry (Feature 1). Launched by the container ENTRYPOINT (`bun run serve`).
 *
 * Boot order: load config → migrate + open a session (when a DB is configured) →
 * build telemetry (NDJSON + Postgres sink) → serve. Starts the autonomous job runner
 * (Feature 2) unless RUN_WORKER=false. Graceful shutdown drains the pool.
 */
import { loadConfig, providerChain } from "../config/index.ts";
import { LLMBackbone } from "../llm/index.ts";
import { MissionStore } from "../control/store.ts";
import { telemetryFromEnv } from "../telemetry/index.ts";
import { getDb, closeDb, isDbConfigured } from "../persistence/db.ts";
import { runMigrations } from "../persistence/migrate.ts";
import { startSession, applyRetention, environment } from "../persistence/session.ts";
import { createApp } from "./app.ts";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT ?? 8080);
const HARNESS_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

async function main(): Promise<void> {
  const config = loadConfig();
  const buildLLM = () => {
    const chain = providerChain(config);
    if (chain.length === 0) throw new Error("no provider configured");
    return new LLMBackbone({ configs: chain });
  };
  const store = new MissionStore(process.env.VERITAS_RUNS_DIR ?? ".veritas/runs");

  // Persistence (optional): migrate + session + dev retention.
  let db;
  let sessionId: string | undefined;
  if (isDbConfigured()) {
    await runMigrations();
    db = getDb();
    const env = environment();
    sessionId = await startSession(db, env);
    await applyRetention(db, env, sessionId);
    process.stdout.write(`server: db connected, session ${sessionId} (env=${env})\n`);
  } else {
    process.stdout.write("server: no DATABASE_URL — running without persistence\n");
  }

  // Telemetry bus shared by missions + SSE + Postgres sink.
  const telem = telemetryFromEnv(undefined, db && sessionId ? { db, sessionId } : undefined);

  const app = createApp({
    buildLLM,
    store,
    config,
    missionsDir: HARNESS_ROOT,
    bus: telem?.bus,
    db,
    sessionId,
  });

  // Feature 2 worker starts here when wired (RUN_WORKER !== "false").

  const server = Bun.serve({ port: PORT, fetch: app.fetch });
  process.stdout.write(`server: listening on :${PORT} (provider=${config.defaultProvider})\n`);

  const shutdown = async () => {
    server.stop();
    telem?.detach();
    await closeDb();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  process.stderr.write(`server: fatal — ${(err as Error).message}\n`);
  process.exit(1);
});
