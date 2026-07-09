/**
 * create-harness — the ordered pipeline that turns a name into a live harness
 * under harness/<name>/ (invariant #4: every new project init progresses in order
 * and creates a subfolder in harness/).
 *
 * Ordered stages (each logged so the progression is visible):
 *   1. validate      — kebab-case name, not already registered, dir is free
 *   2. scaffold      — copy the 8-plane template, token-substituting the name
 *   3. capabilities  — install selected capability packs' harness-specific skills
 *                      into harness/<name>/skills/ (invariant #3: harness-specific
 *                      skills are initialized at run time, not shipped at the meta root)
 *   4. manifest      — write harness/<name>/harness.json
 *   5. register      — append to the root registry with the next 1-based index
 *   6. install       — bun install inside the new harness
 *   7. test          — bun test inside the new harness (must be green)
 *
 * `createHarness()` is pure of process concerns and returns a result, so it is
 * unit-testable; the CLI wrapper handles argv, stdout, and exit codes.
 */
import { join } from "node:path";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { readRegistry, writeRegistry, addHarness, nextIndex, findByName, PLANES, type HarnessEntry } from "./registry.ts";
import { writeManifest, type Manifest } from "./manifest.ts";
import { copyDirWithTokens, isKebabCase, availablePacks, packSkillNames } from "./scaffold.ts";

const META_DIR = import.meta.dir;
const TEMPLATE_DIR = join(META_DIR, "templates", "harness-template");
const PACKS_DIR = join(META_DIR, "templates", "skills");

export interface CreateOptions {
  root: string;
  name: string;
  capabilities?: string[];
  /** Run `bun install` in the new harness (default true). */
  install?: boolean;
  /** Run `bun test` in the new harness (default true). */
  test?: boolean;
  /** Sink for progress lines (default: discard). */
  log?: (line: string) => void;
}

export interface CreateResult {
  path: string;
  index: number;
  manifest: Manifest;
  skills: string[];
}

function run(cmd: string, args: string[], cwd: string): { ok: boolean; output: string } {
  const res = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  return { ok: res.status === 0, output: `${res.stdout ?? ""}${res.stderr ?? ""}` };
}

export function createHarness(opts: CreateOptions): CreateResult {
  const log = opts.log ?? (() => {});
  const capabilities = opts.capabilities ?? [];

  // 1. validate
  log(`[1/7] validate "${opts.name}"`);
  if (!isKebabCase(opts.name)) throw new Error(`harness name must be kebab-case: "${opts.name}"`);
  const registry = readRegistry(opts.root);
  if (findByName(registry, opts.name)) throw new Error(`harness "${opts.name}" is already registered`);
  const dir = join(opts.root, "harness", opts.name);
  if (existsSync(dir)) throw new Error(`directory already exists: harness/${opts.name}`);
  const known = availablePacks(PACKS_DIR);
  for (const cap of capabilities) {
    if (!known.includes(cap)) throw new Error(`unknown capability pack "${cap}". available: ${known.join(", ") || "(none)"}`);
  }

  // 2. scaffold the 8-plane template
  log(`[2/7] scaffold planes → harness/${opts.name}`);
  copyDirWithTokens(TEMPLATE_DIR, dir, { __HARNESS_NAME__: opts.name });

  // 3. install capability packs (harness-specific skills, initialized at run time)
  const installedSkills: string[] = [];
  for (const cap of capabilities) {
    const packDir = join(PACKS_DIR, cap);
    log(`[3/7] capability "${cap}" → skills/`);
    copyDirWithTokens(packDir, join(dir, "skills"), { __HARNESS_NAME__: opts.name });
    installedSkills.push(...packSkillNames(packDir));
  }

  // 4. manifest
  const index = nextIndex(registry);
  const manifest: Manifest = {
    name: opts.name,
    index,
    description: `Harness #${index} — scaffolded from the meta-harness template.`,
    capabilities,
    planes: [...PLANES],
    skills: installedSkills,
  };
  log(`[4/7] manifest → harness/${opts.name}/harness.json (index #${index})`);
  writeManifest(dir, manifest);

  // 5. register
  const entry: HarnessEntry = {
    name: opts.name,
    index,
    path: `harness/${opts.name}`,
    capabilities,
    planes: [...PLANES],
    createdAt: new Date().toISOString().slice(0, 10),
    status: "active",
  };
  log(`[5/7] register in ${join(opts.root, "harnesses.json")}`);
  writeRegistry(opts.root, addHarness(registry, entry));

  // 6. install
  if (opts.install !== false) {
    log(`[6/7] bun install`);
    const res = run("bun", ["install"], dir);
    if (!res.ok) throw new Error(`bun install failed:\n${res.output}`);
  } else {
    log(`[6/7] bun install (skipped)`);
  }

  // 7. test
  if (opts.test !== false) {
    log(`[7/7] bun test`);
    const res = run("bun", ["test"], dir);
    if (!res.ok) throw new Error(`bun test failed in new harness:\n${res.output}`);
  } else {
    log(`[7/7] bun test (skipped)`);
  }

  return { path: dir, index, manifest, skills: installedSkills };
}

function parseArgs(argv: string[]): { name?: string; capabilities: string[] } {
  let name: string | undefined;
  const capabilities: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--capabilities" || a === "-c") {
      const val = argv[++i];
      if (val) capabilities.push(...val.split(",").map((s) => s.trim()).filter(Boolean));
    } else if (!a.startsWith("-") && !name) {
      name = a;
    }
  }
  return { name, capabilities };
}

function main(): void {
  const { name, capabilities } = parseArgs(process.argv.slice(2));
  if (!name) {
    process.stdout.write("usage: bun run create-harness <name> [--capabilities a,b]\n");
    process.stdout.write(`available capability packs: ${availablePacks(PACKS_DIR).join(", ") || "(none)"}\n`);
    process.exit(1);
  }
  try {
    const result = createHarness({ root: process.cwd(), name, capabilities, log: (l) => process.stdout.write(`${l}\n`) });
    process.stdout.write(`\n✅ harness #${result.index} created at ${result.path}\n`);
    if (result.skills.length) process.stdout.write(`   skills: ${result.skills.join(", ")}\n`);
    process.stdout.write(`\nNext: cd harness/${name} && bun run dev planes\n`);
  } catch (err) {
    process.stdout.write(`\n❌ ${(err as Error).message}\n`);
    process.exit(1);
  }
}

if (import.meta.main) main();
