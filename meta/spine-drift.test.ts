/**
 * Enforces invariant #8 (compose, don't fork): the 8-plane spine has exactly
 * one canonical copy, under core/spine/. No harness may re-embed a spine
 * module — that is precisely the fork this refactor eliminates. A harness
 * that needs spine behavior imports it via the `@spine/*` path alias.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, test } from "bun:test";

const ROOT = join(import.meta.dir, "..");
const SPINE_DIR = join(ROOT, "core", "spine");
const HARNESS_DIR = join(ROOT, "harness");

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walkFiles(full));
    } else if (entry.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

function listHarnesses(): string[] {
  return readdirSync(HARNESS_DIR).filter((e) => statSync(join(HARNESS_DIR, e)).isDirectory());
}

// Harnesses migrated onto the shared spine (import spine modules via the
// `@spine/*` alias, carry no local copy). `solo-hackathon`, and the
// `meta/templates/harness-template/` seed it and future create-harness output
// derive from, still carry an older, independently-diverged implementation of
// these same modules (different Mission/evidence-gate/tool contracts, not
// just a copy) — migrating them is a real API port, not a mechanical dedup,
// and is tracked as a follow-up in PLAN-MASTER-META-HARNESS.md §3.3. They are
// intentionally excluded from the drift check below until that lands.
const MIGRATED_HARNESSES = ["veritas-research", "veritas-example"];

// Computed once and shared by both tests below (rather than each test
// re-walking core/spine/ independently). Guarded by existsSync so a missing
// spine directory fails the first test cleanly instead of crashing at
// module load.
const spineFiles = existsSync(SPINE_DIR) ? walkFiles(SPINE_DIR).map((f) => relative(SPINE_DIR, f)) : [];

test("spine exists and covers the expected planes", () => {
  expect(existsSync(SPINE_DIR)).toBe(true);
  const dirs = new Set(spineFiles.map((f) => f.split("/")[0]));
  for (const expected of ["safety", "tools", "mission", "evidence", "parse", "config", "llm", "orchestration"]) {
    expect(dirs.has(expected)).toBe(true);
  }
});

test("spine drift: no migrated harness re-embeds a canonical core/spine module", () => {
  const offenders: string[] = [];
  const registered = listHarnesses();

  for (const harness of MIGRATED_HARNESSES) {
    expect(registered).toContain(harness);
    const srcDir = join(HARNESS_DIR, harness, "src");
    if (!existsSync(srcDir)) continue;
    for (const rel of spineFiles) {
      const candidate = join(srcDir, rel);
      if (existsSync(candidate)) {
        offenders.push(`harness/${harness}/src/${rel} duplicates core/spine/${rel}`);
      }
    }
  }

  expect(offenders).toEqual([]);
});
