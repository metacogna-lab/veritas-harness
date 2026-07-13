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
 *   veritas rsi            # self-improving loop, DRY-RUN only (human-gated apply)
 *
 * Scope is derived from the chosen loadout's target adapter. Gated tools run
 * unattended here, so anything above `active` fails safe unless explicitly
 * pre-authorized with --pre-auth (invariant #2).
 */
import { loadConfig, providerChain } from "./config/index.ts";
import { LLMBackbone } from "./llm/index.ts";
import { ControlPlane, PlanEvalError } from "./control/plane.ts";
import { MissionStore } from "./control/store.ts";
import { defaultLoadouts } from "./agent/loadouts.ts";
import { loadResearchPlan } from "./resources/research-plan.ts";
import { runIngest } from "./ingest/ingest.ts";
import { digestSources } from "./resources/source-digest.ts";
import { evalPlanWithConfig, renderEvalReport } from "./resources/plan-eval.ts";
import { rsiDryRun } from "./rsi/dry-run.ts";
import { telemetryFromEnv } from "./telemetry/index.ts";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { printBanner } from "./banner.ts";

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
  if (process.stdout.isTTY) printBanner();
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

  if (verb === "rsi") {
    // Self-improving loop, DRY-RUN only: mine → propose → validate → human-gated apply.
    // Never applies an edit; the apply stage is gated by requireHumanRelease (invariant #5).
    const summary = await rsiDryRun();
    print(summary);
    return 0;
  }

  if (verb === "eval") {
    const { flags } = parseFlags(rest);
    const planPath = flags.plan;
    if (!planPath) return usage("eval --plan <research-plan.json>");
    try {
      const plan = loadResearchPlan(planPath);
      const result = evalPlanWithConfig(plan);
      print(renderEvalReport(result));
      return result.pass ? 0 : 1;
    } catch (err) {
      process.stderr.write(`eval: ${(err as Error).message}\n`);
      return 1;
    }
  }

  if (verb === "digest") {
    const { flags } = parseFlags(rest);
    const planPath = flags.plan;
    if (!planPath) return usage("digest --plan <research-plan.json> [--force]");
    try {
      const plan = loadResearchPlan(planPath);
      const harnessRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
      const result = await digestSources({
        plan,
        harnessRoot,
        llm: buildLLM(),
        force: flags.force === "true",
        onEvent: print,
      });
      print(`digest: complete — ${result.sources.length} source(s) → ${result.summaryDir}`);
      print(`digest: synthesis → ${result.synthesisPath}`);
      return 0;
    } catch (err) {
      process.stderr.write(`digest: ${(err as Error).message}\n`);
      return 1;
    }
  }

  if (verb === "ingest") {
    const { flags } = parseFlags(rest);
    const input = flags.input;
    if (!input) return usage("ingest --input <NEW.md> [--slug <slug>] [--dry-run]");
    try {
      const { plan, outputPath } = await runIngest({
        inputPath: input,
        slug: flags.slug,
        dryRun: flags["dry-run"] === "true",
      });
      if (flags["dry-run"] === "true") {
        print(JSON.stringify(plan, null, 2));
      } else {
        print(`ingest: wrote ${outputPath}`);
        print(`  objective: ${plan.objective}`);
        print(`  loadout: ${plan.loadout}`);
      }
      return 0;
    } catch (err) {
      process.stderr.write(`ingest: ${(err as Error).message}\n`);
      return 1;
    }
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
    // Telemetry (W4) — opt-in via LOG_FILE; zero-cost and inert when unset.
    const telem = telemetryFromEnv();
    const plane = new ControlPlane({ llm: buildLLM(), store, bus: telem?.bus });
    const preAuth = flags["pre-auth"] ? flags["pre-auth"].split(",").map((s) => s.trim()) : undefined;
    try {
      const { id, result } = await plane.start({
        objective,
        target,
        plan,
        loadout: flags.loadout ?? plan?.loadout,
        role: flags.role,
        maxSteps: flags["max-steps"] ? Number(flags["max-steps"]) : undefined,
        policy: preAuth ? { preAuthorized: preAuth } : undefined,
        onEvent: print,
        skipDigest: flags["skip-digest"] === "true",
      });
      print(`\nmission ${id} finished: ${result.status}`);
      return result.status === "error" ? 1 : 0;
    } catch (err) {
      if (err instanceof PlanEvalError) {
        process.stderr.write(`\n${err.message}\n`);
        return 1;
      }
      throw err;
    } finally {
      telem?.detach();
    }
  }

  return usage("start | eval | digest | ingest | status | report | loadouts");
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
