#!/usr/bin/env bun
/**
 * Lessons CLI — plan 03 §3.4 (LIVE: recording only).
 *
 *   bun scripts/lessons.mjs record <snapshot.json> [--out resources/lessons.json]
 *   bun scripts/lessons.mjs retrieve "<objective query>"
 *   bun scripts/lessons.mjs list
 *
 * ROADMAP: automatic feedback of retrieved lessons into orchestrator planning
 * is NOT implemented — see src/resources/lessons.ts header comment.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LessonsStore } from "../src/resources/lessons.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT = join(ROOT, "resources", "lessons.json");

function readJSON(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "help" || cmd === "--help") {
    console.log("usage: lessons.mjs record <snapshot.json> [--out path]");
    console.log("       lessons.mjs retrieve \"<objective>\"");
    console.log("       lessons.mjs list");
    return 0;
  }

  if (cmd === "record") {
    const snapshotPath = rest[0];
    if (!snapshotPath) {
      console.error("lessons: record requires a snapshot path");
      return 1;
    }
    const outIdx = rest.indexOf("--out");
    const out = outIdx >= 0 ? rest[outIdx + 1] : DEFAULT_OUT;
    const full = snapshotPath.startsWith("/") ? snapshotPath : join(ROOT, snapshotPath);
    if (!existsSync(full)) {
      console.error(`lessons: snapshot not found: ${full}`);
      return 1;
    }
    const snapshot = readJSON(full);
    const store = new LessonsStore(out);
    const lesson = store.recordFromSnapshot(snapshot);
    console.log(`lessons: recorded ${lesson.id} → ${out}`);
    return 0;
  }

  if (cmd === "retrieve") {
    const query = rest.join(" ").trim();
    if (!query) {
      console.error("lessons: retrieve requires an objective query string");
      return 1;
    }
    const store = new LessonsStore(DEFAULT_OUT);
    const hits = store.retrieveLessons(query);
    if (hits.length === 0) {
      console.log("lessons: no relevant lessons found.");
      return 0;
    }
    for (const l of hits) {
      console.log(`\n[${l.id}] ${l.objective}`);
      if (l.worked.length) console.log(`  worked: ${l.worked.join("; ")}`);
      if (l.failed.length) console.log(`  failed: ${l.failed.join("; ")}`);
      if (l.gaps.length) console.log(`  gaps: ${l.gaps.join("; ")}`);
    }
    return 0;
  }

  if (cmd === "list") {
    const store = new LessonsStore(DEFAULT_OUT);
    const all = store.list();
    if (all.length === 0) {
      console.log("lessons: store is empty.");
      return 0;
    }
    for (const l of all) console.log(`${l.id}\t${l.objective}`);
    return 0;
  }

  console.error(`lessons: unknown command "${cmd}"`);
  return 1;
}

process.exit(await main());
