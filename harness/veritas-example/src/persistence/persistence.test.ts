/**
 * Feature 4 gates. Guarded by DATABASE_URL — when unset (default CI / local without a
 * DB) the whole suite is skipped so `bun test` stays green everywhere. A live Postgres
 * (docker compose up postgres) plus DATABASE_URL exercises the real gates:
 *   G1 migrate idempotent · G2 sink parity · G3 dev retention · G4 non-throwing sink.
 */
import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { getDb, closeDb, type Db } from "./db.ts";
import { runMigrations } from "./migrate.ts";
import { startSession, applyRetention } from "./session.ts";
import { insertEvent, listEventsByMission } from "./repo.ts";
import { EventBus, summarise } from "../telemetry/index.ts";
import { PgSink } from "../telemetry/pg-sink.ts";
import type { HarnessEvent } from "../telemetry/types.ts";
import { sql as drizzleSql } from "drizzle-orm";

const DB_URL = process.env.DATABASE_URL;
const describeDb = DB_URL ? describe : describe.skip;

describeDb("Feature 4 — Postgres persistence", () => {
  let db: Db;

  beforeAll(async () => {
    await runMigrations(DB_URL);
    db = getDb(DB_URL);
  });
  afterAll(async () => {
    await closeDb();
  });

  it("G1: runMigrations is idempotent (second run does not throw)", async () => {
    await runMigrations(DB_URL);
    await runMigrations(DB_URL);
    expect(true).toBe(true);
  });

  it("G2: PgSink persists events; listEventsByMission + summarise reach parity", async () => {
    const sessionId = await startSession(db, "test");
    const bus = new EventBus();
    const sink = new PgSink(db, sessionId);
    const off = sink.attach(bus);

    const missionId = `m_${Date.now()}`;
    const emitted: HarnessEvent[] = [
      { kind: "mission.start", missionId, slug: "parity", objective: "verify parity" },
      { kind: "step.execute", missionId, step: 1, tool: "read_file", riskTier: "safe" },
      { kind: "tool.scope_deny", missionId, tool: "http_get", reason: "off scope" },
      { kind: "mission.end", missionId, status: "ok", durationMs: 12 },
    ];
    for (const e of emitted) bus.emit(e);
    // Sink writes are fire-and-forget; give them a tick to flush.
    await new Promise((r) => setTimeout(r, 250));
    off();

    const readBack = await listEventsByMission(db, missionId);
    expect(readBack.length).toBe(emitted.length);
    const metrics = summarise(readBack);
    expect(metrics.missionId).toBe(missionId);
    expect(metrics.steps).toBe(1);
    expect(metrics.scopeDenials).toBe(1);
    expect(metrics.durationMs).toBe(12);
  });

  it("G3: dev retention purges prior sessions, keeps current; prod keeps both", async () => {
    const prior = await startSession(db, "dev");
    await insertEvent(db, prior, { kind: "mission.start", missionId: "m_prior", slug: "p", objective: "x" });
    const current = await startSession(db, "dev");
    await insertEvent(db, current, { kind: "mission.start", missionId: "m_current", slug: "c", objective: "y" });

    await applyRetention(db, "dev", current);
    expect((await listEventsByMission(db, "m_prior")).length).toBe(0);
    expect((await listEventsByMission(db, "m_current")).length).toBe(1);

    // prod is a no-op: a second prior session survives retention.
    const prodPrior = await startSession(db, "prod");
    await insertEvent(db, prodPrior, { kind: "mission.start", missionId: "m_prod_prior", slug: "pp", objective: "z" });
    const prodCurrent = await startSession(db, "prod");
    await applyRetention(db, "prod", prodCurrent);
    expect((await listEventsByMission(db, "m_prod_prior")).length).toBe(1);
  });

  it("G4: PgSink with a broken db never throws and does not break emit", async () => {
    const brokenDb = getDb("postgres://nouser:nopass@127.0.0.1:1/nope");
    const sessionId = "00000000-0000-0000-0000-000000000000";
    const bus = new EventBus();
    const sink = new PgSink(brokenDb, sessionId);
    sink.attach(bus);
    expect(() =>
      bus.emit({ kind: "mission.start", missionId: "m_broken", slug: "b", objective: "x" }),
    ).not.toThrow();
    await new Promise((r) => setTimeout(r, 100));
  });
});

// Cleanup helper kept explicit so a shared test DB does not accumulate rows across runs.
afterAll(async () => {
  if (!DB_URL) return;
  try {
    const db = getDb(DB_URL);
    await db.execute(drizzleSql`TRUNCATE events, logs, missions, jobs, sessions CASCADE`);
    await closeDb();
  } catch {
    /* best-effort */
  }
});
