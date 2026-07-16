/**
 * Experience store — writes structured, queryable mission output to
 * resources/experience/<mission-id>/ after each run. The outer-loop RSI
 * pipeline reads this store rather than ingesting in-context summaries
 * (per the meta-harness research: queryable history beats compressed context).
 *
 * Layout per mission:
 *   entry.json          — ExperienceEntry metadata
 *   transcript.jsonl    — one TranscriptEntry per line
 *   findings.jsonl      — one Finding per line
 *   scores.json         — BenchmarkScores or null
 *   failure-clusters.md — written by RSI weakness miner, not this module
 *
 * All JSONL files are append-only. entry.json and scores.json are overwritten
 * idempotently (same missionId always produces the same content).
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { MissionSnapshot, TranscriptEntry, Finding } from "@spine/mission/types.ts";

// ── public types ──────────────────────────────────────────────────────────────

export interface HarnessConfigSnapshot {
  loadout: string;
  specialistRoles: string[];
  toolNames: string[];
  scopeHosts: string[];
  scopePaths: string[];
}

export interface BenchmarkScores {
  suite: string;
  passAt1: number;
  tasks: { id: string; passed: boolean }[];
}

export interface ExperienceEntry {
  missionId: string;
  slug: string;
  recordedAt: string;
  harnessConfig: HarnessConfigSnapshot;
  scores: BenchmarkScores | null;
  /** Relative path to failure-clusters.md, set by RSI after mining. */
  failureClusterPath: string | null;
}

// ── internal helpers ──────────────────────────────────────────────────────────

function experienceDir(storeRoot: string, missionId: string): string {
  return join(storeRoot, missionId);
}

function appendJsonl(path: string, record: unknown): void {
  writeFileSync(path, JSON.stringify(record) + "\n", { flag: "a", encoding: "utf8" });
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Write a complete experience entry for one mission run. Idempotent on
 * entry.json and scores.json; JSONL files accumulate (safe to call multiple
 * times for the same missionId only if transcript/findings have changed, but
 * callers should prefer calling once per completed mission).
 */
export function writeExperienceEntry(
  storeRoot: string,
  snapshot: MissionSnapshot,
  config: HarnessConfigSnapshot,
  scores: BenchmarkScores | null = null,
): ExperienceEntry {
  const dir = experienceDir(storeRoot, snapshot.id);
  mkdirSync(dir, { recursive: true });

  const entry: ExperienceEntry = {
    missionId: snapshot.id,
    slug: snapshot.id,
    recordedAt: new Date().toISOString(),
    harnessConfig: config,
    scores,
    failureClusterPath: null,
  };

  writeFileSync(join(dir, "entry.json"), JSON.stringify(entry, null, 2), "utf8");
  writeFileSync(join(dir, "scores.json"), JSON.stringify(scores, null, 2), "utf8");

  // Write transcript as JSONL (one entry per line, readable by jq/grep)
  const transcriptPath = join(dir, "transcript.jsonl");
  writeFileSync(transcriptPath, "", { flag: "w", encoding: "utf8" }); // reset for idempotency
  for (const entry of snapshot.transcript) {
    appendJsonl(transcriptPath, entry);
  }

  // Write findings as JSONL
  const findingsPath = join(dir, "findings.jsonl");
  writeFileSync(findingsPath, "", { flag: "w", encoding: "utf8" });
  for (const finding of snapshot.findings) {
    appendJsonl(findingsPath, finding);
  }

  return entry;
}

/**
 * Return all TranscriptEntry records for a mission where the entry indicates
 * a tool call failure. Reads from transcript.jsonl.
 *
 * "Failed" means: kind === "tool_call" whose content starts with "ERROR:" or
 * kind === "observation" whose meta.status === "error" (harness convention).
 */
export function readFailedCalls(storeRoot: string, missionId: string): TranscriptEntry[] {
  const path = join(experienceDir(storeRoot, missionId), "transcript.jsonl");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as TranscriptEntry)
    .filter(
      (e) =>
        (e.kind === "tool_call" && e.content.startsWith("ERROR:")) ||
        (e.kind === "observation" && (e.meta?.status === "error" || e.meta?.error === true)),
    );
}

/**
 * List all missions in the store, newest first. Returns ExperienceEntry[]
 * sorted by recordedAt descending.
 */
export function listExperienceMissions(storeRoot: string): ExperienceEntry[] {
  if (!existsSync(storeRoot)) return [];
  return readdirSync(storeRoot)
    .filter((name) => {
      const dir = join(storeRoot, name);
      return statSync(dir).isDirectory() && existsSync(join(dir, "entry.json"));
    })
    .map((name) => JSON.parse(readFileSync(join(storeRoot, name, "entry.json"), "utf8")) as ExperienceEntry)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

/** Read a single ExperienceEntry by missionId. Returns null if not found. */
export function readEntry(storeRoot: string, missionId: string): ExperienceEntry | null {
  const path = join(experienceDir(storeRoot, missionId), "entry.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as ExperienceEntry;
}

/**
 * Update scores.json + entry.json.scores for a mission (P1).
 * Prefer embedding scores at writeExperienceEntry time when available;
 * this helper fills scores after a late bench run. Note: plan docs once
 * named a sibling harness-config.json — config lives in entry.harnessConfig.
 */
export function writeExperienceScores(
  storeRoot: string,
  missionId: string,
  scores: BenchmarkScores,
): ExperienceEntry | null {
  const entry = readEntry(storeRoot, missionId);
  if (!entry) return null;
  const updated: ExperienceEntry = { ...entry, scores };
  const dir = experienceDir(storeRoot, missionId);
  writeFileSync(join(dir, "entry.json"), JSON.stringify(updated, null, 2), "utf8");
  writeFileSync(join(dir, "scores.json"), JSON.stringify(scores, null, 2), "utf8");
  return updated;
}
