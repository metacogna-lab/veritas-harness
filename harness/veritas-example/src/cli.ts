#!/usr/bin/env tsx
/**
 * Control-plane CLI — the human front door.
 *
 *   veritas interactive          # Claude Code–style planning shell (TTY)
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
 *
 * Structure (v0.2 M-5): the verb logic is a dispatch table of small handlers over a
 * `CliContext`, and the whole thing runs through `run(deps)` with injectable argv /
 * print sinks / LLM factory / store dir — so it is unit-testable without a network,
 * an API key, or process.exit. The module entry only wires real deps + exit codes.
 */
import { loadConfig, providerChain } from "./config/index.ts";
import { LLMBackbone } from "./llm/index.ts";
import { ControlPlane, PlanEvalError, type StartInput } from "./control/plane.ts";
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
import { runInteractive } from "./interactive/index.ts";

const DEFAULT_RUNS_DIR = process.env.VERITAS_RUNS_DIR ?? ".veritas/runs";

export interface CliDeps {
  /** Arguments after the program name (i.e. process.argv.slice(2)). */
  argv: string[];
  /** stdout sink (default: process.stdout). */
  print?: (line: string) => void;
  /** stderr sink (default: process.stderr). */
  printErr?: (line: string) => void;
  /** LLM factory (default: build from config). Injected in tests to avoid network. */
  buildLLM?: () => LLMBackbone;
  /** Mission store directory (default: VERITAS_RUNS_DIR). */
  runsDir?: string;
  /** Whether to print the banner (default: process.stdout.isTTY). */
  banner?: boolean;
  /**
   * Treat stdout as a TTY for bare-argv interactive entry.
   * Defaults to process.stdout.isTTY — CI/non-TTY keeps usage error (never hangs).
   */
  isTTY?: boolean;
  /** Injectable line reader for interactive mode (tests). */
  ask?: (prompt: string) => Promise<string | null>;
}

interface CliContext {
  rest: string[];
  positionals: string[];
  flags: Record<string, string>;
  print: (line: string) => void;
  printErr: (line: string) => void;
  store: MissionStore;
  buildLLM: () => LLMBackbone;
  usage: (msg: string) => number;
}

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

function defaultBuildLLM(): LLMBackbone {
  const config = loadConfig();
  const chain = providerChain(config);
  if (chain.length === 0) throw new Error("no provider configured");
  return new LLMBackbone({ configs: chain });
}

// ── verb handlers ─────────────────────────────────────────────────────────────

async function handleLoadouts(ctx: CliContext): Promise<number> {
  for (const l of defaultLoadouts().list()) ctx.print(`${l.name} — ${l.description}`);
  return 0;
}

async function handleStatus(ctx: CliContext): Promise<number> {
  const id = ctx.positionals[0];
  if (!id) return ctx.usage("status <id>");
  const plane = new ControlPlane({ llm: ctx.buildLLM(), store: ctx.store });
  const status = plane.status(id);
  if (!status) {
    ctx.print(`unknown mission ${id}`);
    return 1;
  }
  ctx.print(status);
  return 0;
}

async function handleReport(ctx: CliContext): Promise<number> {
  const id = ctx.positionals[0];
  if (!id) return ctx.usage("report <id>");
  const plane = new ControlPlane({ llm: ctx.buildLLM(), store: ctx.store });
  const report = plane.report(id);
  if (!report) {
    ctx.print(`unknown mission ${id}`);
    return 1;
  }
  ctx.print(report);
  return 0;
}

async function handleRsi(ctx: CliContext): Promise<number> {
  // Self-improving loop, DRY-RUN only: mine → propose → validate → human-gated apply.
  // Never applies an edit; the apply stage is gated by requireHumanRelease (invariant #5).
  ctx.print(await rsiDryRun());
  return 0;
}

async function handleEval(ctx: CliContext): Promise<number> {
  const planPath = ctx.flags.plan;
  if (!planPath) return ctx.usage("eval --plan <research-plan.json>");
  try {
    const result = evalPlanWithConfig(loadResearchPlan(planPath));
    ctx.print(renderEvalReport(result));
    return result.pass ? 0 : 1;
  } catch (err) {
    ctx.printErr(`eval: ${(err as Error).message}`);
    return 1;
  }
}

async function handleDigest(ctx: CliContext): Promise<number> {
  const planPath = ctx.flags.plan;
  if (!planPath) return ctx.usage("digest --plan <research-plan.json> [--force]");
  try {
    const plan = loadResearchPlan(planPath);
    const harnessRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const result = await digestSources({
      plan,
      harnessRoot,
      llm: ctx.buildLLM(),
      force: ctx.flags.force === "true",
      onEvent: ctx.print,
    });
    ctx.print(`digest: complete — ${result.sources.length} source(s) → ${result.summaryDir}`);
    ctx.print(`digest: synthesis → ${result.synthesisPath}`);
    return 0;
  } catch (err) {
    ctx.printErr(`digest: ${(err as Error).message}`);
    return 1;
  }
}

async function handleIngest(ctx: CliContext): Promise<number> {
  const input = ctx.flags.input;
  if (!input) return ctx.usage("ingest --input <NEW.md> [--slug <slug>] [--dry-run]");
  try {
    const { plan, outputPath } = await runIngest({
      inputPath: input,
      slug: ctx.flags.slug,
      dryRun: ctx.flags["dry-run"] === "true",
    });
    if (ctx.flags["dry-run"] === "true") {
      ctx.print(JSON.stringify(plan, null, 2));
    } else {
      ctx.print(`ingest: wrote ${outputPath}`);
      ctx.print(`  objective: ${plan.objective}`);
      ctx.print(`  loadout: ${plan.loadout}`);
    }
    return 0;
  } catch (err) {
    ctx.printErr(`ingest: ${(err as Error).message}`);
    return 1;
  }
}

async function handleStart(ctx: CliContext): Promise<number> {
  const { positionals, flags } = ctx;
  const plan = flags.plan ? loadResearchPlan(flags.plan) : undefined;
  const preAuth = flags["pre-auth"] ? flags["pre-auth"].split(",").map((s) => s.trim()) : undefined;

  // B3: build EXACTLY ONE intake variant — a plan, or an ad-hoc objective+target.
  const common = {
    loadout: flags.loadout,
    role: flags.role,
    maxSteps: flags["max-steps"] ? Number(flags["max-steps"]) : undefined,
    policy: preAuth ? { preAuthorized: preAuth } : undefined,
    onEvent: ctx.print,
    skipDigest: flags["skip-digest"] === "true",
  };
  let input: StartInput;
  if (plan) {
    input = { plan, ...common };
  } else {
    const objective = positionals[0];
    const target = flags.target;
    if (!objective || !target) {
      return ctx.usage('start "<objective>" --target <t> | start --plan <research-plan.json>');
    }
    input = { objective, target, ...common };
  }

  // Telemetry (W4) — opt-in via LOG_FILE; zero-cost and inert when unset.
  const telem = telemetryFromEnv();
  const plane = new ControlPlane({ llm: ctx.buildLLM(), store: ctx.store, bus: telem?.bus });
  try {
    const { id, result } = await plane.start(input);
    ctx.print(`\nmission ${id} finished: ${result.status}`);
    return result.status === "error" ? 1 : 0;
  } catch (err) {
    if (err instanceof PlanEvalError) {
      ctx.printErr(`\n${err.message}`);
      return 1;
    }
    throw err;
  } finally {
    telem?.detach();
  }
}

const HANDLERS: Record<string, (ctx: CliContext) => Promise<number>> = {
  loadouts: handleLoadouts,
  status: handleStatus,
  report: handleReport,
  rsi: handleRsi,
  eval: handleEval,
  digest: handleDigest,
  ingest: handleIngest,
  start: handleStart,
};

/** Testable entry point. Returns an exit code; never calls process.exit. */
export async function run(deps: CliDeps): Promise<number> {
  const print = deps.print ?? ((l: string) => process.stdout.write(`${l}\n`));
  const printErr = deps.printErr ?? ((l: string) => process.stderr.write(`${l}\n`));
  const showBanner = deps.banner ?? Boolean(process.stdout.isTTY);
  const isTTY = deps.isTTY ?? Boolean(process.stdout.isTTY);
  const buildLLM = deps.buildLLM ?? defaultBuildLLM;

  const [verb, ...rest] = deps.argv;

  // Bare TTY / explicit interactive → Claude Code–style planning shell.
  // Non-TTY bare argv keeps usage error so CI/Docker never hang on stdin.
  if ((!verb && isTTY) || verb === "interactive") {
    return runInteractive({
      print,
      printErr,
      buildLLM,
      runsDir: deps.runsDir ?? DEFAULT_RUNS_DIR,
      banner: showBanner,
      ask: deps.ask,
    });
  }

  if (showBanner) printBanner();

  const { positionals, flags } = parseFlags(rest);
  const usage = (msg: string): number => {
    printErr(`usage: veritas ${msg}`);
    return 2;
  };

  const handler = verb ? HANDLERS[verb] : undefined;
  if (!handler) {
    return usage(
      "interactive | start | eval | digest | ingest | status | report | loadouts | rsi",
    );
  }

  const ctx: CliContext = {
    rest,
    positionals,
    flags,
    print,
    printErr,
    store: new MissionStore(deps.runsDir ?? DEFAULT_RUNS_DIR),
    buildLLM,
    usage,
  };
  return handler(ctx);
}

// Module entry: run with real deps only when invoked directly (works under tsx/node
// and bun). Importing this file (e.g. from a test) does not trigger execution.
const invokedDirectly = (() => {
  try {
    return process.argv[1] === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  run({ argv: process.argv.slice(2) })
    .then((code) => process.exit(code))
    .catch((err) => {
      process.stderr.write(`error: ${(err as Error).message}\n`);
      process.exit(1);
    });
}
