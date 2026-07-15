#!/usr/bin/env bun
/**
 * Root `veritas` CLI — thin launcher that forwards argv to a registered harness.
 *
 * Usage (from repo root):
 *   bun run veritas -- <verb> [flags…]
 *   veritas <verb> [flags…]          # after `bun link` / bin install
 *
 * Harness selection (first match wins):
 *   1. --harness <name>
 *   2. VERITAS_HARNESS env
 *   3. active harness with "research" capability
 *   4. first active harness by registry index
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findByName, readRegistry, type HarnessEntry, type Registry } from "./registry.ts";

/** Repo root = parent of `meta/`. */
export function repoRoot(fromFile = import.meta.url): string {
  return resolve(dirname(fileURLToPath(fromFile)), "..");
}

/** Strip `--harness <name>` (and lone `--harness`) from argv; return selection + rest. */
export function peelHarnessFlag(argv: string[]): { harness?: string; rest: string[] } {
  const rest: string[] = [];
  let harness: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--harness") {
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        harness = next;
        i++;
      }
      continue;
    }
    if (a.startsWith("--harness=")) {
      harness = a.slice("--harness=".length) || undefined;
      continue;
    }
    rest.push(a);
  }
  return { harness, rest };
}

/**
 * Pick which registered harness owns the control-plane CLI.
 * Prefers an explicit name, then research-capable, then first active by index.
 */
export function resolveHarness(
  registry: Registry,
  opts: { name?: string; envName?: string } = {},
): HarnessEntry {
  const active = registry.harnesses.filter((h) => h.status === "active");
  if (active.length === 0) {
    throw new Error("no active harnesses in harnesses.json — run bun run create-harness <name>");
  }

  const wanted = opts.name ?? opts.envName;
  if (wanted) {
    const hit = findByName(registry, wanted);
    if (!hit) {
      const names = active.map((h) => h.name).join(", ");
      throw new Error(`harness "${wanted}" is not registered (active: ${names})`);
    }
    if (hit.status !== "active") {
      throw new Error(`harness "${wanted}" is archived — pick an active harness`);
    }
    return hit;
  }

  const research = active.find((h) => h.capabilities.includes("research"));
  if (research) return research;

  return [...active].sort((a, b) => a.index - b.index)[0]!;
}

/** Absolute path to `<harness>/src/cli.ts`. */
export function harnessCliPath(root: string, entry: HarnessEntry): string {
  return join(root, entry.path, "src", "cli.ts");
}

export interface LaunchResult {
  code: number;
  harness: HarnessEntry;
  cliPath: string;
  argv: string[];
}

/**
 * Resolve harness + spawn its CLI. Injectable spawn for tests.
 * Returns the child exit code (never calls process.exit).
 */
export async function launchVeritas(opts: {
  root: string;
  argv: string[];
  env?: NodeJS.ProcessEnv;
  spawn?: (cliPath: string, args: string[], cwd: string) => Promise<number>;
}): Promise<LaunchResult> {
  const env = opts.env ?? process.env;
  const { harness: flagName, rest } = peelHarnessFlag(opts.argv);
  const registry = readRegistry(opts.root);
  const harness = resolveHarness(registry, {
    name: flagName,
    envName: env.VERITAS_HARNESS,
  });
  const cliPath = harnessCliPath(opts.root, harness);
  if (!existsSync(cliPath)) {
    throw new Error(`harness CLI missing at ${cliPath}`);
  }

  const spawn =
    opts.spawn ??
    (async (path, args, cwd) => {
      const proc = Bun.spawn(["bun", path, ...args], {
        cwd,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
        env,
      });
      return await proc.exited;
    });

  const code = await spawn(cliPath, rest, opts.root);
  return { code, harness, cliPath, argv: rest };
}

async function main(): Promise<number> {
  try {
    const result = await launchVeritas({
      root: repoRoot(),
      argv: process.argv.slice(2),
    });
    return result.code;
  } catch (err) {
    process.stderr.write(`veritas: ${(err as Error).message}\n`);
    process.stderr.write(
      "usage: veritas [--harness <name>] <start|eval|digest|ingest|status|report|loadouts|rsi> [flags…]\n",
    );
    return 2;
  }
}

if (import.meta.main) {
  main().then((code) => process.exit(code));
}
