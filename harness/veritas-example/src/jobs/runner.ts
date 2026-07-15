/**
 * Autonomous job runner (Feature 2). A poll loop that launches with the container,
 * claims queued jobs, and executes them via the harness pipelines using the configured
 * provider — with no per-job human trigger.
 *
 * SAFETY (invariant #5): the runner is UNATTENDED. If a mission signals that a
 * terminal action needs human release, the job is set `held` (never `done`) and parked
 * for explicit release via the API. The runner never auto-releases. Runaway loops are
 * bounded by `maxSteps` (per job) and the mission's own step ceiling.
 */
import type { JobQueue } from "./queue.ts";
import type { Job, MissionExecutor, IngestExecutor } from "./types.ts";

export interface JobRunnerOptions {
  queue: JobQueue;
  runMission: MissionExecutor;
  runIngest?: IngestExecutor;
  /** Poll interval in ms. Default 1500. */
  pollMs?: number;
  /** Max attempts before a job is failed permanently. Default 1. */
  maxAttempts?: number;
  /** Event sink for observability (default: no-op). */
  onEvent?: (line: string) => void;
}

export class JobRunner {
  private readonly queue: JobQueue;
  private readonly runMission: MissionExecutor;
  private readonly runIngest?: IngestExecutor;
  private readonly pollMs: number;
  private readonly maxAttempts: number;
  private readonly emit: (line: string) => void;
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;
  private stopped = false;

  constructor(opts: JobRunnerOptions) {
    this.queue = opts.queue;
    this.runMission = opts.runMission;
    this.runIngest = opts.runIngest;
    this.pollMs = opts.pollMs ?? 1500;
    this.maxAttempts = opts.maxAttempts ?? 1;
    this.emit = opts.onEvent ?? (() => {});
  }

  /** Begin polling. Non-blocking. */
  start(): void {
    this.stopped = false;
    this.schedule(0);
  }

  /** Stop polling after the in-flight tick. */
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    // Let an in-flight tick settle.
    while (this.running) await new Promise((r) => setTimeout(r, 10));
  }

  private schedule(delay: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.tick(), delay);
  }

  /** Claim and run one job (exposed for deterministic tests). */
  async tick(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      const job = await this.queue.claimNext();
      if (job) await this.dispatch(job);
    } catch (err) {
      this.emit(`job-runner: tick error — ${(err as Error).message}`);
    } finally {
      this.running = false;
      this.schedule(this.pollMs);
    }
  }

  private async dispatch(job: Job): Promise<void> {
    this.emit(`job ${job.id} (${job.type}) claimed`);
    try {
      if (job.spec.kind === "mission") {
        const outcome = await this.runMission(job.spec);
        if (outcome.outcome === "needs_release") {
          // Unattended runner never auto-releases (invariant #5).
          await this.queue.hold(job.id, `needs human release: ${outcome.detail}`);
          this.emit(`job ${job.id} HELD — ${outcome.detail}`);
          return;
        }
        if (outcome.outcome === "error") {
          await this.failOrRetry(job, outcome.error);
          return;
        }
        await this.queue.complete(job.id, outcome.result);
        this.emit(`job ${job.id} done`);
        return;
      }

      if (job.spec.kind === "ingest") {
        if (!this.runIngest) throw new Error("ingest executor not configured");
        const result = await this.runIngest(job.spec);
        await this.queue.complete(job.id, result);
        this.emit(`job ${job.id} done (ingest)`);
        return;
      }
    } catch (err) {
      await this.failOrRetry(job, (err as Error).message);
    }
  }

  private async failOrRetry(job: Job, error: string): Promise<void> {
    if (job.attempts >= this.maxAttempts) {
      await this.queue.fail(job.id, error);
      this.emit(`job ${job.id} error (attempts=${job.attempts}) — ${error}`);
    } else {
      // Leave as queued for another claim by resetting is out of scope for the pg impl;
      // with maxAttempts=1 (default) a first failure is terminal. Recorded as error.
      await this.queue.fail(job.id, error);
      this.emit(`job ${job.id} error — ${error}`);
    }
  }
}
