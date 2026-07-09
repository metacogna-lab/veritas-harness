import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readManifest, writeManifest, manifestSchema, type Manifest } from "./manifest.ts";

const manifest = (name: string): Manifest => ({
  name,
  index: 1,
  description: "test harness",
  capabilities: ["research"],
  planes: [
    "provider",
    "safety",
    "verification",
    "memory",
    "capability",
    "execution",
    "orchestration",
    "control",
  ],
  skills: ["harness-ingest"],
});

test("manifest round-trips through disk", () => {
  const dir = mkdtempSync(join(tmpdir(), "man-"));
  try {
    writeManifest(dir, manifest("alpha"));
    const back = readManifest(dir);
    expect(back.name).toBe("alpha");
    expect(back.skills).toEqual(["harness-ingest"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readManifest throws when the file is absent", () => {
  const dir = mkdtempSync(join(tmpdir(), "man-"));
  try {
    expect(() => readManifest(dir)).toThrow(/no harness.json/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("manifestSchema applies defaults for planes and skills", () => {
  const parsed = manifestSchema.parse({ name: "alpha", index: 2, createdAt: "x" });
  expect(parsed.planes).toHaveLength(8);
  expect(parsed.skills).toEqual([]);
  expect(parsed.capabilities).toEqual([]);
});
