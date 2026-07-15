/**
 * Job queue (Feature 2). A durable, Postgres-backed FIFO queue — no external broker
 * (DEPENDENCIES.md rejects Redis/RabbitMQ). `claimNext` uses `FOR UPDATE SKIP LOCKED`
 * so concurrent workers never double-run a job. An in-memory implementation of the
 * same interface backs DB-free runner tests.
 */
import { sql } from "drizzle-orm";
import type { Db } from "../persistence/db.ts";
import type { Job, JobSpec, JobStatus, JobType } from "./types.ts";

export interface JobQueue {
  enqueue(type: JobType, spec: JobSpec): Promise<Job>;
  claimNext(): Promise<Job | undefined>;
  complete(id: string, result: unknown): Promise<void>;
  fail(id: string, error: string): Promise<void>;
  hold(id: string, reason: string): Promise<void>;
  get(id: string): Promise<Job | undefined>;
  list(status?: JobStatus): Promise<Job[]>;
}

function rowToJob(r: Record<string, unknown>): Job {
  return {
    id: String(r.id),
    sessionId: String(r.session_id),
    type: r.type as JobType,
    spec: r.spec as JobSpec,
    status: r.status as JobStatus,
    result: r.result ?? undefined,
    error: (r.error as string) ?? undefined,
    attempts: Number(r.attempts ?? 0),
    createdAt: r.created_at ? new Date(r.created_at as string) : undefined,
    startedAt: r.started_at ? new Date(r.started_at as string) : undefined,
    finishedAt: r.finished_at ? new Date(r.finished_at as string) : undefined,
  };
}

/** Postgres-backed queue. */
export class PgJobQueue implements JobQueue {
  constructor(
    private readonly db: Db,
    private readonly sessionId: string,
  ) {}

  async enqueue(type: JobType, spec: JobSpec): Promise<Job> {
    const rows = await this.db.execute(
      sql`INSERT INTO jobs (session_id, type, spec) VALUES (${this.sessionId}, ${type}, ${JSON.stringify(spec)}::jsonb) RETURNING *`,
    );
    return rowToJob((rows as unknown as Record<string, unknown>[])[0]!);
  }

  /** Atomically claim the oldest queued job (safe under concurrent workers). */
  async claimNext(): Promise<Job | undefined> {
    const rows = (await this.db.execute(
      sql`UPDATE jobs SET status='running', started_at=now(), attempts=attempts+1
          WHERE id = (SELECT id FROM jobs WHERE status='queued' ORDER BY created_at
                      FOR UPDATE SKIP LOCKED LIMIT 1)
          RETURNING *`,
    )) as unknown as Record<string, unknown>[];
    return rows[0] ? rowToJob(rows[0]) : undefined;
  }

  async complete(id: string, result: unknown): Promise<void> {
    await this.db.execute(
      sql`UPDATE jobs SET status='done', result=${JSON.stringify(result)}::jsonb, finished_at=now() WHERE id=${id}`,
    );
  }

  async fail(id: string, error: string): Promise<void> {
    await this.db.execute(sql`UPDATE jobs SET status='error', error=${error}, finished_at=now() WHERE id=${id}`);
  }

  async hold(id: string, reason: string): Promise<void> {
    await this.db.execute(sql`UPDATE jobs SET status='held', error=${reason}, finished_at=now() WHERE id=${id}`);
  }

  async get(id: string): Promise<Job | undefined> {
    const rows = (await this.db.execute(sql`SELECT * FROM jobs WHERE id=${id}`)) as unknown as Record<string, unknown>[];
    return rows[0] ? rowToJob(rows[0]) : undefined;
  }

  async list(status?: JobStatus): Promise<Job[]> {
    const rows = (status
      ? await this.db.execute(sql`SELECT * FROM jobs WHERE status=${status} ORDER BY created_at DESC`)
      : await this.db.execute(sql`SELECT * FROM jobs ORDER BY created_at DESC`)) as unknown as Record<string, unknown>[];
    return rows.map(rowToJob);
  }
}

/** In-memory queue for DB-free runner tests (same semantics, single-process). */
export class InMemoryJobQueue implements JobQueue {
  private readonly jobs = new Map<string, Job>();
  private seq = 0;
  constructor(private readonly sessionId = "test-session") {}

  async enqueue(type: JobType, spec: JobSpec): Promise<Job> {
    const id = `job_${++this.seq}`;
    const job: Job = { id, sessionId: this.sessionId, type, spec, status: "queued", attempts: 0, createdAt: new Date() };
    this.jobs.set(id, job);
    return job;
  }
  async claimNext(): Promise<Job | undefined> {
    const next = [...this.jobs.values()].filter((j) => j.status === "queued").sort((a, b) => +a.createdAt! - +b.createdAt!)[0];
    if (!next) return undefined;
    next.status = "running";
    next.attempts += 1;
    next.startedAt = new Date();
    return next;
  }
  async complete(id: string, result: unknown): Promise<void> {
    const j = this.jobs.get(id);
    if (j) Object.assign(j, { status: "done" as JobStatus, result, finishedAt: new Date() });
  }
  async fail(id: string, error: string): Promise<void> {
    const j = this.jobs.get(id);
    if (j) Object.assign(j, { status: "error" as JobStatus, error, finishedAt: new Date() });
  }
  async hold(id: string, reason: string): Promise<void> {
    const j = this.jobs.get(id);
    if (j) Object.assign(j, { status: "held" as JobStatus, error: reason, finishedAt: new Date() });
  }
  async get(id: string): Promise<Job | undefined> {
    return this.jobs.get(id);
  }
  async list(status?: JobStatus): Promise<Job[]> {
    const all = [...this.jobs.values()];
    return status ? all.filter((j) => j.status === status) : all;
  }
}
