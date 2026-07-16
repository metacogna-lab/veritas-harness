import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LessonsStore, lessonFromSnapshot, formatPlanningAdvisory, normalizeLesson, type Lesson } from "./lessons.ts";
import type { MissionSnapshot } from "@spine/mission/types.ts";

const snap: MissionSnapshot = {
  id: "m-1",
  objective: "audit app.ts for debug flag",
  scope: { hosts: [], paths: ["/work"] },
  status: "done",
  transcript: [
    { seq: 0, timestamp: "t", kind: "objective", content: "audit app.ts for debug flag" },
    { seq: 1, timestamp: "t", kind: "tool_call", content: "read_file" },
    { seq: 2, timestamp: "t", kind: "observation", content: "export const debug = true" },
  ],
  findings: [
    {
      id: "f1",
      claim: "debug enabled",
      status: "confirmed",
      provenance: { toolCall: "read_file", observationSeq: 2 },
      createdAt: "t",
    },
  ],
};

describe("lessons", () => {
  test("lessonFromSnapshot extracts worked/failed/gaps heuristics", () => {
    const lesson = lessonFromSnapshot(snap, () => "2026-01-01T00:00:00Z");
    expect(lesson.worked.some((w) => w.includes("confirmed"))).toBe(true);
    expect(lesson.worked.some((w) => w.includes("read_file"))).toBe(true);
    expect(lesson.objective).toBe("audit app.ts for debug flag");
  });

  test("recordLesson persists and retrieveLessons returns by objective overlap", () => {
    const dir = mkdtempSync(join(tmpdir(), "veritas-lessons-"));
    const path = join(dir, "lessons.json");
    const store = new LessonsStore(path);

    store.recordLesson({
      missionId: "m-1",
      objective: "audit app.ts for debug flag",
      worked: ["read_file found debug=true"],
      failed: [],
      gaps: [],
    });
    store.recordLesson({
      missionId: "m-2",
      objective: "scan external API hosts",
      worked: ["http_get succeeded"],
      failed: [],
      gaps: [],
    });

    const hits = store.retrieveLessons("audit debug flag in app.ts");
    expect(hits.length).toBe(1);
    expect(hits[0]!.missionId).toBe("m-1");
    expect(existsSync(path)).toBe(true);
    // File is NDJSON: one JSON object per line
    const onDisk = readFileSync(path, "utf8").trim().split("\n").map((l) => JSON.parse(l) as Lesson);
    expect(onDisk).toHaveLength(2);
  });

  test("recordFromSnapshot writes committed lesson file", () => {
    const dir = mkdtempSync(join(tmpdir(), "veritas-lessons-"));
    const store = new LessonsStore(join(dir, "lessons.json"));
    const lesson = store.recordFromSnapshot(snap);
    expect(lesson.id).toBe("lesson-m-1");
    expect(store.list()).toHaveLength(1);
  });

  test("retrieveLessonsForPlanning is OFF by default — surfaces nothing", () => {
    const dir = mkdtempSync(join(tmpdir(), "veritas-lessons-"));
    const store = new LessonsStore(join(dir, "lessons.json"));
    store.recordLesson({ missionId: "m-1", objective: "audit app.ts for debug flag", worked: ["found it"] });

    const disabled = store.retrieveLessonsForPlanning("audit debug flag in app.ts", { enabled: false });
    expect(disabled.enabled).toBe(false);
    expect(disabled.lessons).toHaveLength(0);
    expect(disabled.advisory).toBe("");
  });

  test("retrieveLessonsForPlanning surfaces read-only advisory when opted in", () => {
    const dir = mkdtempSync(join(tmpdir(), "veritas-lessons-"));
    const store = new LessonsStore(join(dir, "lessons.json"));
    store.recordLesson({ missionId: "m-1", objective: "audit app.ts for debug flag", worked: ["read_file found debug=true"] });

    const enabled = store.retrieveLessonsForPlanning("audit debug flag in app.ts", { enabled: true });
    expect(enabled.enabled).toBe(true);
    expect(enabled.lessons).toHaveLength(1);
    expect(enabled.advisory).toContain("read-only");
    expect(enabled.advisory).toContain("read_file found debug=true");
  });

  test("formatPlanningAdvisory is empty for no lessons and never prescribes mutation", () => {
    expect(formatPlanningAdvisory([])).toBe("");
    const lesson: Lesson = {
      id: "l1",
      missionId: "m1",
      objective: "obj",
      worked: ["w"],
      failed: ["f"],
      gaps: ["g"],
      recordedAt: "t",
      harnessSurface: "",
      helpfulnessCount: 0,
      harmfulnessCount: 0,
      status: "active",
    };
    const text = formatPlanningAdvisory([lesson]);
    expect(text).toContain("do not auto-apply");
  });
});

describe("lessons delta store (T4)", () => {
  function makeStore() {
    const dir = mkdtempSync(join(tmpdir(), "veritas-lessons-delta-"));
    return new LessonsStore(join(dir, "lessons.json"));
  }

  test("normalizeLesson fills in missing delta fields with safe defaults", () => {
    const raw = { id: "l1", missionId: "m1", objective: "obj", worked: [], failed: [], gaps: [], recordedAt: "t" };
    const lesson = normalizeLesson(raw);
    expect(lesson.harnessSurface).toBe("");
    expect(lesson.helpfulnessCount).toBe(0);
    expect(lesson.harmfulnessCount).toBe(0);
    expect(lesson.status).toBe("active");
  });

  test("recordLesson populates harnessSurface and status defaults", () => {
    const store = makeStore();
    const lesson = store.recordLesson({ missionId: "m-surf", objective: "test", harnessSurface: "src/safety/scope.ts" });
    expect(lesson.harnessSurface).toBe("src/safety/scope.ts");
    expect(lesson.status).toBe("active");
    expect(lesson.helpfulnessCount).toBe(0);
    expect(lesson.harmfulnessCount).toBe(0);
  });

  test("getLessonsByHarnessSurface returns only active lessons for that surface", () => {
    const store = makeStore();
    store.recordLesson({ missionId: "m1", objective: "scope test", harnessSurface: "src/safety/scope.ts" });
    store.recordLesson({ missionId: "m2", objective: "tool test", harnessSurface: "src/tools/" });
    store.recordLesson({ missionId: "m3", objective: "misc", harnessSurface: "" });

    const scopeLessons = store.getLessonsByHarnessSurface("src/safety/scope.ts");
    // exact surface match + empty-surface lessons (broad advisory)
    expect(scopeLessons.map((l) => l.missionId).sort()).toEqual(["m1", "m3"].sort());

    const toolLessons = store.getLessonsByHarnessSurface("src/tools/");
    expect(toolLessons.map((l) => l.missionId).sort()).toEqual(["m2", "m3"].sort());
  });

  test("getLessonsByHarnessSurface excludes deprecated lessons", () => {
    const store = makeStore();
    store.recordLesson({ missionId: "m-dep", objective: "obj", harnessSurface: "src/safety/scope.ts" });
    // Deprecate: 1 helpful then 2 harmful triggers 2:1 ratio
    store.markLessonOutcome("lesson-m-dep", "helpful");
    store.markLessonOutcome("lesson-m-dep", "harmful");
    store.markLessonOutcome("lesson-m-dep", "harmful");

    const results = store.getLessonsByHarnessSurface("src/safety/scope.ts");
    expect(results.find((l) => l.missionId === "m-dep")).toBeUndefined();
  });

  test("markLessonOutcome increments helpfulnessCount on 'helpful'", () => {
    const store = makeStore();
    store.recordLesson({ missionId: "m-h", objective: "obj", harnessSurface: "scope.ts" });
    const updated = store.markLessonOutcome("lesson-m-h", "helpful");
    expect(updated?.helpfulnessCount).toBe(1);
    expect(updated?.harmfulnessCount).toBe(0);
    expect(updated?.status).toBe("active");
  });

  test("markLessonOutcome increments harmfulnessCount on 'harmful'", () => {
    const store = makeStore();
    store.recordLesson({ missionId: "m-harm", objective: "obj", harnessSurface: "scope.ts" });
    const updated = store.markLessonOutcome("lesson-m-harm", "harmful");
    expect(updated?.harmfulnessCount).toBe(1);
    expect(updated?.status).toBe("active");
  });

  test("auto-deprecation triggers at 2:1 harm:helpful ratio", () => {
    const store = makeStore();
    store.recordLesson({ missionId: "m-auto", objective: "obj", harnessSurface: "scope.ts" });

    // 1 helpful, 2 harmful: ratio exactly 2:1 — should deprecate
    store.markLessonOutcome("lesson-m-auto", "helpful");
    store.markLessonOutcome("lesson-m-auto", "harmful");
    const afterTwo = store.markLessonOutcome("lesson-m-auto", "harmful");
    expect(afterTwo?.status).toBe("deprecated");
    expect(afterTwo?.harmfulnessCount).toBe(2);
    expect(afterTwo?.helpfulnessCount).toBe(1);
  });

  test("auto-deprecation does NOT trigger below 2:1 ratio", () => {
    const store = makeStore();
    store.recordLesson({ missionId: "m-safe", objective: "obj", harnessSurface: "scope.ts" });

    // 2 helpful, 3 harmful: ratio < 2:1 (3/2 = 1.5) — should stay active
    store.markLessonOutcome("lesson-m-safe", "helpful");
    store.markLessonOutcome("lesson-m-safe", "helpful");
    store.markLessonOutcome("lesson-m-safe", "harmful");
    store.markLessonOutcome("lesson-m-safe", "harmful");
    const after = store.markLessonOutcome("lesson-m-safe", "harmful");
    expect(after?.status).toBe("active");
  });

  test("markLessonOutcome returns null for unknown lesson id", () => {
    const store = makeStore();
    expect(store.markLessonOutcome("lesson-nonexistent", "helpful")).toBeNull();
  });

  test("lessons are persisted immutably — markLessonOutcome returns a new object", () => {
    const store = makeStore();
    store.recordLesson({ missionId: "m-immut", objective: "obj", harnessSurface: "scope.ts" });
    const before = store.list()[0]!;
    const after = store.markLessonOutcome("lesson-m-immut", "helpful")!;
    expect(after).not.toBe(before);
    expect(after.helpfulnessCount).toBe(before.helpfulnessCount + 1);
  });
});
