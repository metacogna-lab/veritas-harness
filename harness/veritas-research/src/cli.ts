#!/usr/bin/env tsx
/**
 * Generic control-plane CLI — 8-plane template harness front door.
 *
 *   veritas start "<objective>" --target <t> [--loadout <name>] [--role <r>]
 *                               [--max-steps <n>] [--pre-auth <tool,...>]
 *   veritas status <id>
 *   veritas report <id>
 *   veritas loadouts
 *
 * Scope is derived from the chosen loadout's target adapter. This harness has
 * no built-in loadouts — inject them via a custom ControlPlane or add a
 * src/agent/loadouts.ts (see harness/veritas-example for a full domain example).
 *
 * For research-plan support (ingest, eval, digest, rsi), use veritas-example.
 */
import { loadConfig, providerChain } from "./config/index.ts";
import { LLMBackbone } from "./llm/index.ts";
import { ControlPlane } from "./control/plane.ts";
import { MissionStore } from "./control/store.ts";

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
  const chain = providerChain(config);
  if (chain.length === 0) throw new Error("no provider configured");
  return new LLMBackbone({ configs: chain });
}

function print(line: string): void {
  process.stdout.write(`${line}\n`);
}

async function main(): Promise<number> {
  const [verb, ...rest] = process.argv.slice(2);
  const store = new MissionStore(RUNS_DIR);

  if (verb === "loadouts") {
    const plane = new ControlPlane({ llm: buildLLM(), store });
    const all = plane["loadouts"].list();
    if (all.length === 0) {
      print("(no loadouts registered — add src/agent/loadouts.ts and inject via ControlPlane)");
      print("See harness/veritas-example for a full research-domain example.");
    } else {
      for (const l of all) print(`${l.name} — ${l.description}`);
    }
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

  if (verb === "start") {
    const { positionals, flags } = parseFlags(rest);
    const objective = positionals[0];
    const target = flags.target;
    if (!objective || !target) {
      return usage('start "<objective>" --target <t> [--loadout <name>] [--role <r>]');
    }
    const plane = new ControlPlane({ llm: buildLLM(), store });
    const preAuth = flags["pre-auth"] ? flags["pre-auth"].split(",").map((s) => s.trim()) : undefined;
    const { id, result } = await plane.start({
      objective,
      target,
      loadout: flags.loadout,
      role: flags.role,
      maxSteps: flags["max-steps"] ? Number(flags["max-steps"]) : undefined,
      policy: preAuth ? { preAuthorized: preAuth } : undefined,
      onEvent: print,
    });
    print(`\nmission ${id} finished: ${result.status}`);
    return result.status === "error" ? 1 : 0;
  }

  return usage("start | status | report | loadouts");
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
