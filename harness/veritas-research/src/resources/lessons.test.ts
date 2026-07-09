import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LessonsStore, lessonFromSnapshot, type Lesson } from "./lessons.ts";
import type { MissionSnapshot } from "../mission/types.ts";

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
      provenance: { toolName: "read_file", observationSeq: 2 },
      recordedAt: "t",
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
    const onDisk = JSON.parse(readFileSync(path, "utf8")) as Lesson[];
    expect(onDisk).toHaveLength(2);
  });

  test("recordFromSnapshot writes committed lesson file", () => {
    const dir = mkdtempSync(join(tmpdir(), "veritas-lessons-"));
    const store = new LessonsStore(join(dir, "lessons.json"));
    const lesson = store.recordFromSnapshot(snap);
    expect(lesson.id).toBe("lesson-m-1");
    expect(store.list()).toHaveLength(1);
  });
});
