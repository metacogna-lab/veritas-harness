import { test, expect, describe, beforeEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  writeExperienceEntry,
  readFailedCalls,
  listExperienceMissions,
  readEntry,
  type HarnessConfigSnapshot,
  type BenchmarkScores,
} from "./experience-store.ts";
import type { MissionSnapshot } from "./types.ts";

// ── helpers ────────────────────────────────────────────────────────────────────

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "exp-store-test-"));
}

const baseConfig: HarnessConfigSnapshot = {
  loadout: "research",
  specialistRoles: ["analyst"],
  toolNames: ["read_file", "http_get"],
  scopeHosts: ["example.com"],
  scopePaths: ["src/"],
};

function makeSnapshot(overrides: Partial<MissionSnapshot> = {}): MissionSnapshot {
  return {
    id: "mission-abc",
    objective: "find scope gaps",
    scope: { hosts: ["example.com"], paths: ["src/"] },
    status: "done",
    transcript: [
      { seq: 0, timestamp: "2026-01-01T00:00:00Z", kind: "objective", content: "find scope gaps" },
      { seq: 1, timestamp: "2026-01-01T00:00:01Z", kind: "tool_call", content: "read_file({path:'src/a.ts'})" },
      { seq: 2, timestamp: "2026-01-01T00:00:02Z", kind: "observation", content: "file content here" },
      {
        seq: 3,
        timestamp: "2026-01-01T00:00:03Z",
        kind: "observation",
        content: "SCOPE DENIED: host not allowed",
        meta: { status: "error" },
      },
    ],
    findings: [],
    ...overrides,
  };
}

// ── writeExperienceEntry ───────────────────────────────────────────────────────

describe("writeExperienceEntry", () => {
  let root: string;
  beforeEach(() => { root = tempDir(); });

  test("creates directory structure with expected files", () => {
    const snapshot = makeSnapshot();
    writeExperienceEntry(root, snapshot, baseConfig);

    const { existsSync } = require("node:fs");
    const dir = join(root, "mission-abc");
    expect(existsSync(join(dir, "entry.json"))).toBe(true);
    expect(existsSync(join(dir, "transcript.jsonl"))).toBe(true);
    expect(existsSync(join(dir, "findings.jsonl"))).toBe(true);
    expect(existsSync(join(dir, "scores.json"))).toBe(true);
  });

  test("entry.json has correct missionId and config", () => {
    writeExperienceEntry(root, makeSnapshot(), baseConfig);
    const entry = readEntry(root, "mission-abc");
    expect(entry).not.toBeNull();
    expect(entry!.missionId).toBe("mission-abc");
    expect(entry!.harnessConfig.loadout).toBe("research");
    expect(entry!.failureClusterPath).toBeNull();
  });

  test("transcript.jsonl has one line per transcript entry", () => {
    const { readFileSync } = require("node:fs");
    const snapshot = makeSnapshot();
    writeExperienceEntry(root, snapshot, baseConfig);
    const lines = readFileSync(join(root, "mission-abc", "transcript.jsonl"), "utf8")
      .split("\n").filter((l: string) => l.trim().length > 0);
    expect(lines.length).toBe(snapshot.transcript.length);
  });

  test("each transcript line is valid JSON", () => {
    const { readFileSync } = require("node:fs");
    writeExperienceEntry(root, makeSnapshot(), baseConfig);
    const lines = readFileSync(join(root, "mission-abc", "transcript.jsonl"), "utf8")
      .split("\n").filter((l: string) => l.trim().length > 0);
    expect(() => lines.forEach((l: string) => JSON.parse(l))).not.toThrow();
  });

  test("stores BenchmarkScores when provided", () => {
    const scores: BenchmarkScores = { suite: "scope-gate", passAt1: 0.9, tasks: [{ id: "t1", passed: true }] };
    writeExperienceEntry(root, makeSnapshot(), baseConfig, scores);
    const entry = readEntry(root, "mission-abc");
    expect(entry!.scores?.suite).toBe("scope-gate");
    expect(entry!.scores?.passAt1).toBe(0.9);
  });

  test("scores is null when not provided", () => {
    writeExperienceEntry(root, makeSnapshot(), baseConfig);
    const entry = readEntry(root, "mission-abc");
    expect(entry!.scores).toBeNull();
  });

  test("is idempotent — calling twice does not corrupt entry.json", () => {
    const snapshot = makeSnapshot();
    writeExperienceEntry(root, snapshot, baseConfig);
    writeExperienceEntry(root, snapshot, baseConfig);
    const entry = readEntry(root, "mission-abc");
    expect(entry!.missionId).toBe("mission-abc");
  });
});

// ── readFailedCalls ────────────────────────────────────────────────────────────

describe("readFailedCalls", () => {
  let root: string;
  beforeEach(() => { root = tempDir(); });

  test("returns only transcript entries with meta.status=error", () => {
    writeExperienceEntry(root, makeSnapshot(), baseConfig);
    const failed = readFailedCalls(root, "mission-abc");
    expect(failed).toHaveLength(1);
    expect(failed[0]!.content).toContain("SCOPE DENIED");
  });

  test("returns empty array when mission has no failed calls", () => {
    const snapshot = makeSnapshot({
      transcript: [
        { seq: 0, timestamp: "T", kind: "objective", content: "objective" },
        { seq: 1, timestamp: "T", kind: "observation", content: "ok", meta: { status: "ok" } },
      ],
    });
    writeExperienceEntry(root, snapshot, baseConfig);
    expect(readFailedCalls(root, "mission-abc")).toHaveLength(0);
  });

  test("returns empty array for non-existent mission", () => {
    expect(readFailedCalls(root, "no-such-mission")).toHaveLength(0);
  });

  test("detects tool_call entries that start with ERROR:", () => {
    const snapshot = makeSnapshot({
      transcript: [
        { seq: 0, timestamp: "T", kind: "objective", content: "objective" },
        { seq: 1, timestamp: "T", kind: "tool_call", content: "ERROR: network timeout" },
      ],
    });
    writeExperienceEntry(root, snapshot, baseConfig);
    const failed = readFailedCalls(root, "mission-abc");
    expect(failed).toHaveLength(1);
    expect(failed[0]!.content).toContain("ERROR:");
  });
});

// ── listExperienceMissions ─────────────────────────────────────────────────────

describe("listExperienceMissions", () => {
  let root: string;
  beforeEach(() => { root = tempDir(); });

  test("returns empty array when store is empty", () => {
    expect(listExperienceMissions(root)).toHaveLength(0);
  });

  test("returns empty array when storeRoot does not exist", () => {
    expect(listExperienceMissions(join(root, "nonexistent"))).toHaveLength(0);
  });

  test("returns all written missions", () => {
    writeExperienceEntry(root, makeSnapshot({ id: "m1" }), baseConfig);
    writeExperienceEntry(root, makeSnapshot({ id: "m2" }), baseConfig);
    const list = listExperienceMissions(root);
    expect(list).toHaveLength(2);
    expect(list.map((e) => e.missionId).sort()).toEqual(["m1", "m2"]);
  });

  test("returns missions sorted newest-first (by recordedAt desc)", () => {
    // Write two missions with a slight delay between them
    writeExperienceEntry(root, makeSnapshot({ id: "older" }), baseConfig);
    writeExperienceEntry(root, makeSnapshot({ id: "newer" }), baseConfig);
    const list = listExperienceMissions(root);
    // The last-written entry has a later recordedAt (or equal — either order is stable)
    expect(list.length).toBe(2);
    // Both entries present; ordering relies on ISO string compare
    const timestamps = list.map((e) => e.recordedAt);
    const sorted = [...timestamps].sort((a, b) => b.localeCompare(a));
    expect(timestamps).toEqual(sorted);
  });
});

// ── readEntry ─────────────────────────────────────────────────────────────────

describe("readEntry", () => {
  let root: string;
  beforeEach(() => { root = tempDir(); });

  test("returns null for non-existent missionId", () => {
    expect(readEntry(root, "ghost")).toBeNull();
  });

  test("returns the correct entry after write", () => {
    writeExperienceEntry(root, makeSnapshot({ id: "m-xyz" }), baseConfig);
    const entry = readEntry(root, "m-xyz");
    expect(entry).not.toBeNull();
    expect(entry!.missionId).toBe("m-xyz");
    expect(entry!.harnessConfig.toolNames).toContain("read_file");
  });
});
