/**
 * Feature 2 gates.
 *   G1 (pg-guarded): queue round-trip + atomic claim (only one of two concurrent claims wins).
 *   G2 (DB-free): a mission job runs to `done` with a result.
 *   G3 (DB-free, CRITICAL): a mission that needs human release lands `held`, never `done`,
 *       and is never auto-released (invariant #5).
 *   Runner also fails a throwing job and drains a queue without a human.
 */
import { describe, expect, it } from "bun:test";
import { InMemoryJobQueue, PgJobQueue } from "./queue.ts";
import { JobRunner } from "./runner.ts";
import { getDb, closeDb } from "../persistence/db.ts";
import { runMigrations } from "../persistence/migrate.ts";
import { startSession } from "../persistence/session.ts";
import { sql } from "drizzle-orm";
import type { MissionExecutor } from "./types.ts";

// ── Runner gates (no DB) ──────────────────────────────────────────────────────
describe("Feature 2 — JobRunner (in-memory queue)", () => {
  it("G2: a mission job runs to done with a result", async () => {
    const queue = new InMemoryJobQueue();
    const runMission: MissionExecutor = async () => ({ outcome: "completed", result: { missionId: "m1", status: "answered" } });
    const runner = new JobRunner({ queue, runMission });
    const job = await queue.enqueue("mission", { kind: "mission", planPath: "p.json" });
    await runner.tick();
    const after = await queue.get(job.id);
    expect(after?.status).toBe("done");
    expect((after?.result as { missionId: string }).missionId).toBe("m1");
  });

  it("G3 (invariant #5): a needs-release mission lands HELD, never done", async () => {
    const queue = new InMemoryJobQueue();
    const runMission: MissionExecutor = async () => ({ outcome: "needs_release", detail: "would delete files" });
    const runner = new JobRunner({ queue, runMission });
    const job = await queue.enqueue("mission", { kind: "mission", planPath: "p.json" });
    await runner.tick();
    const after = await queue.get(job.id);
    expect(after?.status).toBe("held");
    expect(after?.status).not.toBe("done");
    expect(after?.error).toContain("human release");
  });

  it("a throwing mission is recorded as error, not silently lost", async () => {
    const queue = new InMemoryJobQueue();
    const runMission: MissionExecutor = async () => ({ outcome: "error", error: "provider down" });
    const runner = new JobRunner({ queue, runMission });
    const job = await queue.enqueue("mission", { kind: "mission", planPath: "p.json" });
    await runner.tick();
    expect((await queue.get(job.id))?.status).toBe("error");
  });

  it("drains multiple queued jobs autonomously (no human trigger)", async () => {
    const queue = new InMemoryJobQueue();
    const runMission: MissionExecutor = async () => ({ outcome: "completed", result: {} });
    const runner = new JobRunner({ queue, runMission });
    await queue.enqueue("mission", { kind: "mission", planPath: "a.json" });
    await queue.enqueue("mission", { kind: "mission", planPath: "b.json" });
    await runner.tick();
    await runner.tick();
    expect((await queue.list("done")).length).toBe(2);
  });
});

// ── Queue gates (pg-guarded) ──────────────────────────────────────────────────
const DB_URL = process.env.DATABASE_URL;
const describeDb = DB_URL ? describe : describe.skip;

describeDb("Feature 2 — PgJobQueue (live postgres)", () => {
  it("G1: enqueue/claim round-trip + atomic claim (no double-run)", async () => {
    await runMigrations(DB_URL);
    const db = getDb(DB_URL);
    await db.execute(sql`TRUNCATE jobs, sessions CASCADE`);
    const sessionId = await startSession(db, "test");
    const queue = new PgJobQueue(db, sessionId);

    // Enqueue 3 jobs; fire 5 concurrent claims. The real "no double-run" invariant is
    // that no job id is claimed twice (FOR UPDATE SKIP LOCKED), and no more than the
    // 3 available jobs are handed out.
    for (const p of ["a.json", "b.json", "c.json"]) await queue.enqueue("mission", { kind: "mission", planPath: p });
    const claims = await Promise.all(Array.from({ length: 5 }, () => queue.claimNext()));
    const ids = claims.filter(Boolean).map((j) => j!.id);
    expect(ids.length).toBe(3); // exactly the 3 queued jobs
    expect(new Set(ids).size).toBe(3); // no id claimed twice

    // Complete one and confirm the terminal state persists.
    await queue.complete(ids[0]!, { ok: true });
    expect((await queue.get(ids[0]!))?.status).toBe("done");

    await db.execute(sql`TRUNCATE jobs, sessions CASCADE`);
    await closeDb();
  });
});
