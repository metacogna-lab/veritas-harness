/**
 * Interactive REPL shell — banner, prompt, slash router, planner chat.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { LLMBackbone } from "../llm/index.ts";
import { printBanner, printPromptPrefix } from "../banner.ts";
import { ControlPlane, PlanEvalError } from "../control/plane.ts";
import { MissionStore } from "../control/store.ts";
import { defaultLoadouts } from "../agent/loadouts.ts";
import { runIngest, missionOutputPath } from "../ingest/ingest.ts";
import { dirIngest, walkDir, stageFiles } from "../ingest/dir-scanner.ts";
import { defaultHarnessRoot } from "../ingest/resources-catalog.ts";
import type { PlanSource } from "../ingest/schema.ts";
import { evalPlanWithConfig, renderEvalReport } from "../resources/plan-eval.ts";
import { digestSources } from "../resources/source-digest.ts";
import { loadResearchPlan } from "../resources/research-plan.ts";
import { createStdinApprover } from "./approver.ts";
import { isSlash, parseSlash, renderHelp, KNOWN_COMMANDS } from "./commands.ts";
import { planTurn } from "./planner.ts";
import {
  createSession,
  clearSession,
  summarizeDraft,
  type InteractiveSession,
} from "./session.ts";

export interface ShellDeps {
  print?: (line: string) => void;
  printErr?: (line: string) => void;
  buildLLM: () => LLMBackbone;
  runsDir?: string;
  harnessRoot?: string;
  banner?: boolean;
  ask?: (prompt: string) => Promise<string | null>;
  askApproval?: (question: string) => Promise<string>;
}

const DEFAULT_RUNS_DIR = process.env.VERITAS_RUNS_DIR ?? ".veritas/runs";

/**
 * Run the interactive shell until /quit or EOF. Returns exit code 0.
 * Never calls process.exit.
 */
export async function runShell(deps: ShellDeps): Promise<number> {
  const print = deps.print ?? ((l: string) => process.stdout.write(`${l}\n`));
  const printErr = deps.printErr ?? ((l: string) => process.stderr.write(`${l}\n`));
  const harnessRoot = deps.harnessRoot ?? defaultHarnessRoot();
  const store = new MissionStore(deps.runsDir ?? DEFAULT_RUNS_DIR);
  const session = createSession();

  let ownedAsk = false;
  let ask = deps.ask;
  let rlClose: (() => void) | undefined;
  if (!ask) {
    ownedAsk = true;
    const rl = readline.createInterface({ input: stdin, output: stdout });
    rlClose = () => rl.close();
    ask = async (prompt: string) => {
      try {
        if (prompt === "") {
          printPromptPrefix();
          return await rl.question("");
        }
        return await rl.question(prompt);
      } catch {
        return null;
      }
    };
  }

  const askApproval =
    deps.askApproval ??
    (async (q: string) => {
      const a = await ask!(q);
      return a ?? "";
    });

  if (deps.banner !== false) printBanner({ force: true });
  print("Interactive mode — type /help, or describe a research objective.");
  print("Headless verbs remain available outside this shell for CI/Docker.");
  print("");

  try {
    while (true) {
      const line = await ask("");
      if (line === null) {
        print("");
        print("EOF — leaving interactive shell.");
        break;
      }
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (isSlash(trimmed)) {
        const parsed = parseSlash(trimmed);
        if (!parsed || !parsed.name) {
          printErr("empty slash command — try /help");
          continue;
        }
        if (parsed.name === "quit" || parsed.name === "exit") {
          print("bye");
          break;
        }
        if (!KNOWN_COMMANDS.has(parsed.name)) {
          printErr(`unknown command /${parsed.name} — try /help`);
          continue;
        }
        await dispatchCommand(parsed.name, parsed.args, parsed.tokens, {
          session,
          print,
          printErr,
          buildLLM: deps.buildLLM,
          store,
          harnessRoot,
          ask,
          askApproval,
        });
        continue;
      }

      try {
        const result = await planTurn(session, trimmed, { llm: deps.buildLLM() });
        print(result.message);
      } catch (err) {
        printErr(`planner: ${(err as Error).message}`);
      }
    }
  } finally {
    if (ownedAsk && rlClose) rlClose();
  }

  return 0;
}

interface CmdCtx {
  session: InteractiveSession;
  print: (line: string) => void;
  printErr: (line: string) => void;
  buildLLM: () => LLMBackbone;
  store: MissionStore;
  harnessRoot: string;
  ask: (prompt: string) => Promise<string | null>;
  askApproval: (question: string) => Promise<string>;
}

async function dispatchCommand(
  name: string,
  args: string,
  tokens: string[],
  ctx: CmdCtx,
): Promise<void> {
  switch (name) {
    case "help":
      ctx.print(renderHelp());
      return;
    case "clear":
      clearSession(ctx.session);
      ctx.print("Session cleared.");
      return;
    case "plan":
      cmdPlan(ctx, tokens);
      return;
    case "eval":
      cmdEval(ctx);
      return;
    case "write":
      cmdWrite(ctx);
      return;
    case "ingest":
      await cmdIngest(ctx, args);
      return;
    case "sources":
      await cmdSources(ctx, args);
      return;
    case "digest":
      await cmdDigest(ctx);
      return;
    case "start":
      await cmdStart(ctx);
      return;
    case "status":
      cmdStatus(ctx, tokens[0]);
      return;
    case "report":
      cmdReport(ctx, tokens[0]);
      return;
    case "loadouts":
      for (const l of defaultLoadouts().list()) ctx.print(`${l.name} — ${l.description}`);
      return;
    default:
      ctx.printErr(`unhandled /${name}`);
  }
}

function cmdPlan(ctx: CmdCtx, tokens: string[]): void {
  if (tokens.includes("--json")) {
    if (!ctx.session.draft) {
      ctx.print("No draft yet.");
      return;
    }
    ctx.print(JSON.stringify(ctx.session.draft, null, 2));
    return;
  }
  ctx.print(summarizeDraft(ctx.session));
}

function cmdEval(ctx: CmdCtx): void {
  if (!ctx.session.draft) {
    ctx.printErr("no draft to evaluate — describe an objective or /ingest first");
    return;
  }
  const result = evalPlanWithConfig(ctx.session.draft);
  ctx.session.lastEval = result;
  ctx.print(renderEvalReport(result));
}

function cmdWrite(ctx: CmdCtx): void {
  if (!ctx.session.draft) {
    ctx.printErr("no draft to write");
    return;
  }
  const result = evalPlanWithConfig(ctx.session.draft);
  ctx.session.lastEval = result;
  if (!result.pass) {
    ctx.printErr("/write blocked — required dogma dimensions failed:");
    ctx.print(renderEvalReport(result));
    return;
  }
  const slug = ctx.session.draft.metadata.slug;
  const outputPath = missionOutputPath(ctx.harnessRoot, slug);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(ctx.session.draft, null, 2), "utf8");
  ctx.session.planPath = outputPath;
  ctx.session.slug = slug;
  ctx.print(`wrote ${outputPath}`);
}

async function cmdIngest(ctx: CmdCtx, args: string): Promise<void> {
  const pathArg = args.trim();
  try {
    if (pathArg && existsSync(pathArg)) {
      const { plan } = await runIngest({
        inputPath: pathArg,
        slug: ctx.session.slug,
        harnessRoot: ctx.harnessRoot,
        llm: ctx.buildLLM(),
        dryRun: true,
      });
      ctx.session.draft = plan;
      ctx.session.slug = plan.metadata.slug;
      ctx.session.lastEval = evalPlanWithConfig(plan);
      ctx.print(`ingest compiled draft from ${pathArg} (not written — use /write)`);
      ctx.print(summarizeDraft(ctx.session));
      ctx.print("");
      ctx.print(renderEvalReport(ctx.session.lastEval));
      return;
    }

    const slug =
      (await ctx.ask("Mission slug (e.g. auth-audit): "))?.trim() || ctx.session.slug;
    if (!slug) {
      ctx.printErr("slug is required");
      return;
    }
    const objective = (await ctx.ask("Mission objective: "))?.trim();
    if (!objective) {
      ctx.printErr("objective is required");
      return;
    }
    const target = (await ctx.ask("Target path or scope boundary (optional): "))?.trim() ?? "";
    const dirAnswer = (await ctx.ask("Batch-ingest a folder? (path or blank): "))?.trim() ?? "";

    if (dirAnswer) {
      if (!existsSync(dirAnswer)) {
        ctx.printErr(`directory not found: ${dirAnswer}`);
        return;
      }
      const { plan } = await dirIngest({
        dirPath: dirAnswer,
        slug,
        harnessRoot: ctx.harnessRoot,
        llm: ctx.buildLLM(),
        dryRun: true,
      });
      ctx.session.draft = plan;
      ctx.session.slug = plan.metadata.slug;
      ctx.session.lastEval = evalPlanWithConfig(plan);
      ctx.print(`dir-ingest compiled draft for ${slug} (not written — use /write)`);
      ctx.print(renderEvalReport(ctx.session.lastEval));
      return;
    }

    const targetLine = target ? `target_hint: "${target}"` : "";
    const syntheticContent = [
      "---",
      `title: "${objective}"`,
      `slug: "${slug}"`,
      ...(targetLine ? [targetLine] : []),
      "---",
      "",
      "## research question",
      "",
      objective,
    ].join("\n");

    const { plan } = await runIngest({
      inputPath: `interview-${slug}.md`,
      syntheticContent,
      slug,
      harnessRoot: ctx.harnessRoot,
      llm: ctx.buildLLM(),
      dryRun: true,
    });
    ctx.session.draft = plan;
    ctx.session.slug = plan.metadata.slug;
    ctx.session.lastEval = evalPlanWithConfig(plan);
    ctx.print(`ingest compiled draft for ${slug} (not written — use /write)`);
    ctx.print(renderEvalReport(ctx.session.lastEval));
  } catch (err) {
    ctx.printErr(`ingest: ${(err as Error).message}`);
  }
}

async function cmdSources(ctx: CmdCtx, args: string): Promise<void> {
  const dirPath = args.trim();
  if (!dirPath) {
    ctx.printErr("usage: /sources <directory>");
    return;
  }
  if (!existsSync(dirPath)) {
    ctx.printErr(`directory not found: ${dirPath}`);
    return;
  }
  const slug = ctx.session.slug ?? ctx.session.draft?.metadata.slug;
  if (!slug) {
    ctx.printErr("set a slug first (chat a plan, /ingest, or /plan after drafting)");
    return;
  }
  try {
    const files = walkDir(dirPath);
    if (files.length === 0) {
      ctx.printErr(`no .md/.pdf/.txt files in ${dirPath}`);
      return;
    }
    const staged = stageFiles(files, slug, ctx.harnessRoot);
    const sources: PlanSource[] = staged.map((p) => ({ kind: "doc" as const, path: p }));
    ctx.session.stagedSources = mergeStaged(ctx.session.stagedSources, sources);
    if (ctx.session.draft) {
      ctx.session.draft = {
        ...ctx.session.draft,
        sources: mergeStaged(ctx.session.draft.sources, sources),
      };
    }
    ctx.session.slug = slug;
    ctx.print(`staged ${sources.length} source(s) under research/raw/${slug}/`);
  } catch (err) {
    ctx.printErr(`sources: ${(err as Error).message}`);
  }
}

async function cmdDigest(ctx: CmdCtx): Promise<void> {
  const planPath = ctx.session.planPath;
  if (!planPath) {
    ctx.printErr("no written plan — /write first");
    return;
  }
  try {
    const plan = loadResearchPlan(planPath);
    const result = await digestSources({
      plan,
      harnessRoot: ctx.harnessRoot,
      llm: ctx.buildLLM(),
      onEvent: ctx.print,
    });
    ctx.print(`digest: synthesis → ${result.synthesisPath}`);
  } catch (err) {
    ctx.printErr(`digest: ${(err as Error).message}`);
  }
}

async function cmdStart(ctx: CmdCtx): Promise<void> {
  let plan = ctx.session.draft;
  const planPath = ctx.session.planPath;
  if (planPath) {
    try {
      plan = loadResearchPlan(planPath);
    } catch (err) {
      ctx.printErr(`start: ${(err as Error).message}`);
      return;
    }
  }
  if (!plan) {
    ctx.printErr("no plan — draft + /write, or /ingest then /write");
    return;
  }
  if (!planPath) {
    ctx.printErr("plan not written yet — run /write (after dogma PASS) before /start");
    return;
  }

  const approver = createStdinApprover(ctx.askApproval);
  const plane = new ControlPlane({ llm: ctx.buildLLM(), store: ctx.store });
  try {
    const { id, result } = await plane.start({
      plan,
      policy: { approver },
      onEvent: ctx.print,
    });
    ctx.session.activeMissionId = id;
    ctx.print(`\nmission ${id} finished: ${result.status}`);
  } catch (err) {
    if (err instanceof PlanEvalError) {
      ctx.printErr(`\n${err.message}`);
      return;
    }
    ctx.printErr(`start: ${(err as Error).message}`);
  }
}

function cmdStatus(ctx: CmdCtx, idArg?: string): void {
  const id = idArg ?? ctx.session.activeMissionId;
  if (!id) {
    ctx.printErr("usage: /status <id> (or /start first)");
    return;
  }
  const plane = new ControlPlane({ llm: ctx.buildLLM(), store: ctx.store });
  const status = plane.status(id);
  if (!status) {
    ctx.print(`unknown mission ${id}`);
    return;
  }
  ctx.print(status);
}

function cmdReport(ctx: CmdCtx, idArg?: string): void {
  const id = idArg ?? ctx.session.activeMissionId;
  if (!id) {
    ctx.printErr("usage: /report <id> (or /start first)");
    return;
  }
  const plane = new ControlPlane({ llm: ctx.buildLLM(), store: ctx.store });
  const report = plane.report(id);
  if (!report) {
    ctx.print(`unknown mission ${id}`);
    return;
  }
  ctx.print(report);
}

function mergeStaged(existing: PlanSource[], staged: PlanSource[]): PlanSource[] {
  const seen = new Set(existing.map((s) => s.path));
  const out = [...existing];
  for (const s of staged) {
    if (!seen.has(s.path)) {
      out.push(s);
      seen.add(s.path);
    }
  }
  return out;
}
