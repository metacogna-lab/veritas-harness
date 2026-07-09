/**
 * Lessons store — plan 03 §3.4.
 *
 * LIVE (implemented here):
 *   - `recordLesson()` persists structured lessons from completed missions.
 *   - `retrieveLessons()` loads relevant past lessons by objective keyword overlap.
 *   - `retrieveLessonsForPlanning()` surfaces relevant lessons as READ-ONLY advisory
 *     text for planning — OPT-IN (disabled by default) and human-reviewed. It never
 *     mutates prompts, tools, or scope; it only returns suggestions a planner may show.
 *
 * ROADMAP (still not implemented — do not silently expand scope):
 *   - Automatic injection that mutates specialist prompts, tool registries, or
 *     decomposition without a human in the loop. "The harness learns" is a deliberate
 *     future decision, not a side effect of enabling advisory feedback.
 *
 * Recording is durable and committed; advisory feedback is opt-in; autonomous
 * self-modification remains gated behind human review (invariant #5).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { MissionSnapshot } from "../mission/types.ts";

export interface Lesson {
  id: string;
  missionId: string;
  objective: string;
  /** What worked well in this mission. */
  worked: string[];
  /** What failed or was blocked. */
  failed: string[];
  /** Prompt/tool gaps noticed. */
  gaps: string[];
  recordedAt: string;
}

export interface LessonInput {
  missionId: string;
  objective: string;
  worked?: string[];
  failed?: string[];
  gaps?: string[];
}

/** Opt-in controls for surfacing lessons into planning. Disabled unless `enabled: true`. */
export interface PlanningFeedbackOptions {
  enabled: boolean;
  limit?: number;
}

export interface PlanningFeedback {
  enabled: boolean;
  lessons: Lesson[];
  /** Read-only advisory text a planner MAY surface. Empty when disabled or no matches. */
  advisory: string;
  /** Human-readable note describing the honest scope of this feedback. */
  note: string;
}

/**
 * Render retrieved lessons as a compact, read-only advisory block. Pure — takes
 * lessons, returns text. It suggests; it never instructs the harness to change
 * itself.
 */
export function formatPlanningAdvisory(lessons: Lesson[]): string {
  if (lessons.length === 0) return "";
  const lines = ["Prior-mission advisories (read-only; consider, do not auto-apply):"];
  for (const l of lessons) {
    const bits: string[] = [];
    if (l.worked.length) bits.push(`worked: ${l.worked.join("; ")}`);
    if (l.failed.length) bits.push(`failed: ${l.failed.join("; ")}`);
    if (l.gaps.length) bits.push(`gaps: ${l.gaps.join("; ")}`);
    lines.push(`- [${l.objective}] ${bits.join(" | ") || "no structured notes"}`);
  }
  return lines.join("\n");
}

/** Derive a structured lesson from a mission snapshot (heuristic extraction). */
export function lessonFromSnapshot(snapshot: MissionSnapshot, now = (): string => new Date().toISOString()): Lesson {
  const worked: string[] = [];
  const failed: string[] = [];
  const gaps: string[] = [];

  const confirmed = (snapshot.findings ?? []).filter((f) => f.status === "confirmed").length;
  const retracted = (snapshot.findings ?? []).filter((f) => f.status === "retracted").length;
  if (confirmed > 0) worked.push(`${confirmed} finding(s) confirmed after refutation`);
  if (retracted > 0) failed.push(`${retracted} finding(s) retracted by refuter`);

  const toolCalls = snapshot.transcript.filter((e) => e.kind === "tool_call").map((e) => String(e.content));
  if (toolCalls.length > 0) worked.push(`tools used: ${[...new Set(toolCalls)].join(", ")}`);

  const denials = snapshot.transcript.filter(
    (e) => e.kind === "observation" && String(e.content).includes("DENIED"),
  );
  if (denials.length > 0) failed.push(`${denials.length} gated/denied tool observation(s)`);

  if (snapshot.status === "error") failed.push("mission ended in error status");
  if (confirmed === 0 && snapshot.status === "done") gaps.push("mission completed without confirmed findings");

  return {
    id: `lesson-${snapshot.id}`,
    missionId: snapshot.id,
    objective: snapshot.objective,
    worked,
    failed,
    gaps,
    recordedAt: now(),
  };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

/** Score objective overlap for retrieval ranking. */
function relevanceScore(query: string, lesson: Lesson): number {
  const q = new Set(tokenize(query));
  const l = new Set(tokenize(lesson.objective));
  let overlap = 0;
  for (const t of q) if (l.has(t)) overlap++;
  return overlap;
}

export class LessonsStore {
  constructor(private readonly path: string) {}

  private readAll(): Lesson[] {
    if (!existsSync(this.path)) return [];
    return JSON.parse(readFileSync(this.path, "utf8")) as Lesson[];
  }

  private writeAll(lessons: Lesson[]): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(lessons, null, 2), "utf8");
  }

  /** Append a lesson (idempotent on lesson id). */
  recordLesson(input: LessonInput, now = (): string => new Date().toISOString()): Lesson {
    const lesson: Lesson = {
      id: `lesson-${input.missionId}`,
      missionId: input.missionId,
      objective: input.objective,
      worked: input.worked ?? [],
      failed: input.failed ?? [],
      gaps: input.gaps ?? [],
      recordedAt: now(),
    };
    const all = this.readAll().filter((l) => l.id !== lesson.id);
    all.push(lesson);
    this.writeAll(all);
    return lesson;
  }

  /** Record from a mission snapshot using heuristic extraction. */
  recordFromSnapshot(snapshot: MissionSnapshot): Lesson {
    const lesson = lessonFromSnapshot(snapshot);
    const all = this.readAll().filter((l) => l.id !== lesson.id);
    all.push(lesson);
    this.writeAll(all);
    return lesson;
  }

  /**
   * Retrieve lessons relevant to an objective (keyword overlap).
   * ROADMAP: callers may choose to inject these into planning — not automatic today.
   */
  retrieveLessons(objective: string, limit = 5): Lesson[] {
    return this.readAll()
      .map((l) => ({ l, score: relevanceScore(objective, l) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.l);
  }

  /**
   * OPT-IN advisory feedback for planning. When `enabled` is false (the default
   * intent), returns an empty, disabled result — nothing is surfaced. When enabled,
   * returns relevant lessons plus read-only advisory text. This is the honest
   * boundary: enabling it shows suggestions; it never mutates prompts, tools, or
   * scope, and never promotes itself to autonomous self-modification (invariant #5).
   */
  retrieveLessonsForPlanning(objective: string, opts: PlanningFeedbackOptions): PlanningFeedback {
    if (!opts.enabled) {
      return {
        enabled: false,
        lessons: [],
        advisory: "",
        note: "lessons→planning feedback is opt-in and currently disabled",
      };
    }
    const lessons = this.retrieveLessons(objective, opts.limit ?? 5);
    return {
      enabled: true,
      lessons,
      advisory: formatPlanningAdvisory(lessons),
      note: "advisory only — read-only suggestions; does not mutate prompts, tools, or scope",
    };
  }

  list(): Lesson[] {
    return this.readAll();
  }
}
