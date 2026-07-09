#!/usr/bin/env tsx
/**
 * Control-plane CLI — the human front door.
 *
 *   veritas start "<objective>" --target <t> [--loadout <name>] [--role <r>]
 *                               [--plan <research-plan.json>] [--max-steps <n>]
 *   veritas ingest --input <NEW.md> [--slug <slug>]
 *   veritas status <id>
 *   veritas report <id>
 *   veritas loadouts
 *
 * Scope is derived from the chosen loadout's target adapter. Gated tools run
 * unattended here, so anything above `active` fails safe unless explicitly
 * pre-authorized with --pre-auth (invariant #2).
 */
import { loadConfig, providerConfig } from "./config/index.ts";
import { LLMBackbone } from "./llm/index.ts";
import { ControlPlane } from "./control/plane.ts";
import { MissionStore } from "./control/store.ts";
import { defaultLoadouts } from "./agent/loadouts.ts";
import { loadResearchPlan } from "./resources/research-plan.ts";

const RUNS_DIR = process.env.VERITAS_RUNS_DIR ?? ".veritas/runs";

function parseFlags(args: string[]): { positionals: string[]; flags: Record<string, string> } {
  const positionals: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "true";
      }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}

function buildLLM(): LLMBackbone {
  const config = loadConfig();
  const primary = providerConfig(config);
  if (!primary) throw new Error("no provider configured");
  return new LLMBackbone({ configs: config.providers.length > 0 ? config.providers : [primary] });
}

function print(line: string): void {
  process.stdout.write(`${line}\n`);
}

async function main(): Promise<number> {
  const [verb, ...rest] = process.argv.slice(2);
  const store = new MissionStore(RUNS_DIR);

  if (verb === "loadouts") {
    for (const l of defaultLoadouts().list()) print(`${l.name} — ${l.description}`);
    return 0;
  }

  if (verb === "status") {
    const id = rest[0];
    if (!id) return usage("status <id>");
    const plane = new ControlPlane({ llm: buildLLM(), store });
    const status = plane.status(id);
    if (!status) {
      print(`unknown mission ${id}`);
      return 1;
    }
    print(status);
    return 0;
  }

  if (verb === "report") {
    const id = rest[0];
    if (!id) return usage("report <id>");
    const plane = new ControlPlane({ llm: buildLLM(), store });
    const report = plane.report(id);
    if (!report) {
      print(`unknown mission ${id}`);
      return 1;
    }
    print(report);
    return 0;
  }

  if (verb === "ingest") {
    const { flags } = parseFlags(rest);
    const input = flags.input;
    if (!input) return usage("ingest --input <NEW.md> [--slug <slug>]");
    const { spawnSync } = await import("node:child_process");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join: pathJoin } = await import("node:path");
    const repoRoot = pathJoin(dirname(fileURLToPath(import.meta.url)), "../../..");
    const script = pathJoin(repoRoot, "ingest/scripts/ingest.mjs");
    const args = [script, "--input", input];
    if (flags.slug) args.push("--slug", flags.slug);
    const r = spawnSync("bun", args, { stdio: "inherit", cwd: repoRoot });
    return r.status ?? 1;
  }

  if (verb === "start") {
    const { positionals, flags } = parseFlags(rest);
    const planPath = flags.plan;
    const plan = planPath ? loadResearchPlan(planPath) : undefined;
    const objective = plan?.objective ?? positionals[0];
    const target = plan?.target ?? flags.target;
    if (!objective || !target) {
      return usage('start "<objective>" --target <t> | start --plan <research-plan.json>');
    }
    const plane = new ControlPlane({ llm: buildLLM(), store });
    const preAuth = flags["pre-auth"] ? flags["pre-auth"].split(",").map((s) => s.trim()) : undefined;
    const { id, result } = await plane.start({
      objective,
      target,
      plan,
      loadout: flags.loadout ?? plan?.loadout,
      role: flags.role,
      maxSteps: flags["max-steps"] ? Number(flags["max-steps"]) : undefined,
      policy: preAuth ? { preAuthorized: preAuth } : undefined,
      onEvent: print,
    });
    print(`\nmission ${id} finished: ${result.status}`);
    return result.status === "error" ? 1 : 0;
  }

  return usage("start | ingest | status | report | loadouts");
}

function usage(msg: string): number {
  process.stderr.write(`usage: veritas ${msg}\n`);
  return 2;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    process.exit(1);
  });
