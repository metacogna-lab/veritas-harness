import { test, expect } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDoctor } from "./doctor.ts";
import { writeRegistry, addHarness, emptyRegistry, type HarnessEntry } from "./registry.ts";
import { writeManifest, type Manifest } from "./manifest.ts";

const entry = (name: string): HarnessEntry => ({
  name,
  index: 1,
  path: `harness/${name}`,
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
  createdAt: "2026-07-09",
  status: "active",
});

const manifest = (name: string): Manifest => ({
  name,
  index: 1,
  description: "",
  capabilities: ["research"],
  planes: entry(name).planes,
  skills: [],
});

test("runDoctor passes when a registered harness has a coherent dir + manifest", () => {
  const root = mkdtempSync(join(tmpdir(), "doc-"));
  try {
    const dir = join(root, "harness", "alpha");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), "{}\n");
    writeManifest(dir, manifest("alpha"));
    writeRegistry(root, addHarness(emptyRegistry(), entry("alpha")));

    const checks = runDoctor(root);
    expect(checks.every((c) => c.ok)).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runDoctor flags a registered harness whose directory is missing", () => {
  const root = mkdtempSync(join(tmpdir(), "doc-"));
  try {
    writeRegistry(root, addHarness(emptyRegistry(), entry("ghost")));
    const checks = runDoctor(root);
    expect(checks.some((c) => !c.ok && c.label.includes("directory"))).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
