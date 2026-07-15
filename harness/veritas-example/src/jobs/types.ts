/**
 * Job types (Feature 2). A job is a durable request to run one of the harness's
 * existing pipelines autonomously inside the container. Adds durability + autonomy,
 * not a new execution path.
 */
import type { ResearchPlan } from "../resources/research-plan.ts";

export type JobType = "mission" | "ingest";

/** queued → running → (done | error | held). `held` = needs human release (invariant #5). */
export type JobStatus = "queued" | "running" | "done" | "error" | "held";

export type JobSpec =
  | { kind: "mission"; planPath?: string; plan?: ResearchPlan; loadout?: string; maxSteps?: number }
  | { kind: "ingest"; slug: string; objective: string; target?: string };

export interface Job {
  id: string;
  sessionId: string;
  type: JobType;
  spec: JobSpec;
  status: JobStatus;
  result?: unknown;
  error?: string;
  attempts: number;
  createdAt?: Date;
  startedAt?: Date;
  finishedAt?: Date;
}

/**
 * Outcome of executing a mission for a job. `needs_release` is the honest signal that
 * a terminal action requires a human — an unattended runner turns it into `held`,
 * never `done`. Terminal-action loadouts surface this through the executor seam.
 */
export type MissionExecOutcome =
  | { outcome: "completed"; result: unknown }
  | { outcome: "needs_release"; detail: string }
  | { outcome: "error"; error: string };

/** The seam the runner calls to execute a mission job. Real impl wraps ControlPlane. */
export type MissionExecutor = (spec: Extract<JobSpec, { kind: "mission" }>) => Promise<MissionExecOutcome>;

/** The seam the runner calls to execute an ingest job. */
export type IngestExecutor = (spec: Extract<JobSpec, { kind: "ingest" }>) => Promise<unknown>;
