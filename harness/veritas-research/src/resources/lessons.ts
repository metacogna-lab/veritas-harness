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
  /** Harness module or file this lesson is most relevant to (e.g. "scope.ts", "tools/"). */
  harnessSurface: string;
  /** Times an RSI proposal informed by this lesson was accepted (validation eligible). */
  helpfulnessCount: number;
  /** Times an RSI proposal informed by this lesson was rejected. */
  harmfulnessCount: number;
  /** Active by default; auto-deprecated when harmfulnessCount > helpfulnessCount * 2. */
  status: "active" | "deprecated";
}

export interface LessonInput {
  missionId: string;
  objective: string;
  worked?: string[];
  failed?: string[];
  gaps?: string[];
  /** Which harness module or file this lesson is most relevant to. */
  harnessSurface?: string;
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
    harnessSurface: "",
    helpfulnessCount: 0,
    harmfulnessCount: 0,
    status: "active" as const,
  };
}

/**
 * Normalize a lesson loaded from disk, filling in fields added after initial release.
 * This ensures old lessons.json files without harnessSurface/counts/status still load.
 */
export function normalizeLesson(raw: Partial<Lesson>): Lesson {
  return {
    id: raw.id ?? "",
    missionId: raw.missionId ?? "",
    objective: raw.objective ?? "",
    worked: raw.worked ?? [],
    failed: raw.failed ?? [],
    gaps: raw.gaps ?? [],
    recordedAt: raw.recordedAt ?? "",
    harnessSurface: raw.harnessSurface ?? "",
    helpfulnessCount: raw.helpfulnessCount ?? 0,
    harmfulnessCount: raw.harmfulnessCount ?? 0,
    status: raw.status ?? "active",
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
    return (JSON.parse(readFileSync(this.path, "utf8")) as Partial<Lesson>[]).map(normalizeLesson);
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
      harnessSurface: input.harnessSurface ?? "",
      helpfulnessCount: 0,
      harmfulnessCount: 0,
      status: "active",
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

  /**
   * Return all ACTIVE lessons tagged to a specific harness surface (module/file).
   * Empty string matches lessons with no surface tag (broader advisory).
   */
  getLessonsByHarnessSurface(surface: string): Lesson[] {
    return this.readAll().filter(
      (l) => l.status === "active" && (l.harnessSurface === surface || l.harnessSurface === ""),
    );
  }

  /**
   * Increment helpfulness or harmfulness counter for a lesson. Auto-deprecates
   * when harmfulnessCount > helpfulnessCount * 2 (2:1 harm:helpful ratio).
   * Returns the updated lesson, or null if the id is not found.
   */
  markLessonOutcome(id: string, outcome: "helpful" | "harmful"): Lesson | null {
    const all = this.readAll();
    const idx = all.findIndex((l) => l.id === id);
    if (idx === -1) return null;
    const prev = all[idx]!;
    const updated: Lesson = {
      ...prev,
      helpfulnessCount: outcome === "helpful" ? prev.helpfulnessCount + 1 : prev.helpfulnessCount,
      harmfulnessCount: outcome === "harmful" ? prev.harmfulnessCount + 1 : prev.harmfulnessCount,
    };
    // Auto-deprecate: 2:1 harm:helpful makes the lesson a net negative.
    // Requires at least one helpful mark to avoid cold-start deprecation (0 helpful, 1 harmful).
    const shouldDeprecate =
      updated.helpfulnessCount > 0 && updated.harmfulnessCount >= updated.helpfulnessCount * 2;
    const result: Lesson = { ...updated, status: shouldDeprecate ? "deprecated" : updated.status };
    const next = [...all.slice(0, idx), result, ...all.slice(idx + 1)];
    this.writeAll(next);
    return result;
  }

  list(): Lesson[] {
    return this.readAll();
  }
}
