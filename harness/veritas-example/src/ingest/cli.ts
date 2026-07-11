#!/usr/bin/env tsx
/**
 * Standalone ingest CLI — dual-mode: interactive (human) or headless (agent/CI).
 *
 *   bun run ingest                                      # interactive interview (TTY)
 *   bun run ingest -i                                   # force interactive
 *   bun run ingest -s <slug> -o "objective" [-t path]  # headless agentic
 *   bun run ingest -s <slug> -d /path/to/docs          # directory batch
 *   bun run ingest ... --json                           # structured JSON output
 *   bun run ingest -h                                   # help
 */
import { parseArgs } from "node:util";
import { unlinkSync, existsSync } from "node:fs";
import { loadConfig, providerChain } from "../config/index.ts";
import { LLMBackbone } from "../llm/index.ts";
import { runIngest } from "./ingest.ts";
import { dirIngest } from "./dir-scanner.ts";
import { interviewIngest } from "./interview.ts";
import { evalPlanWithConfig } from "../resources/plan-eval.ts";
import type { ResearchPlan } from "./schema.ts";

const HELP = `
Usage: bun run ingest [options]

Ingestion and staging compiler for Veritas missions.

Options:
  -i, --interactive      Force interactive interview mode (human operator)
  -s, --slug <string>    Mission identifier (e.g. 'auth-audit')
  -o, --objective <str>  Primary mission objective
  -t, --target <path>    Authorized scope boundary / target path
  -f, --files <paths>    Comma-separated list of .md/.pdf files to stage
  -d, --dir <path>       Batch-process a directory of research files
      --json             Output structured JSON only (agentic/CI mode)
  -h, --help             Show this help

Examples:
  bun run ingest                                    # interactive
  bun run ingest -s auth-audit -o "Audit auth"     # headless
  bun run ingest -s docs-sweep -d ./research/raw   # dir batch
  bun run ingest -s auth-audit -o "Audit" --json   # JSON output
`.trim();

function buildLLM(): LLMBackbone {
  const config = loadConfig();
  const chain = providerChain(config);
  if (chain.length === 0) throw new Error("no provider configured");
  return new LLMBackbone({ configs: chain });
}

function log(jsonMode: boolean, line: string): void {
  if (!jsonMode) process.stdout.write(`${line}\n`);
}

function die(jsonMode: boolean, msg: string, code = 1): never {
  if (jsonMode) {
    process.stdout.write(JSON.stringify({ ok: false, error: msg }) + "\n");
  } else {
    process.stderr.write(`error: ${msg}\n`);
  }
  process.exit(code);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      interactive: { type: "boolean", short: "i", default: false },
      slug:        { type: "string",  short: "s" },
      objective:   { type: "string",  short: "o" },
      target:      { type: "string",  short: "t" },
      files:       { type: "string",  short: "f" },
      dir:         { type: "string",  short: "d" },
      json:        { type: "boolean",             default: false },
      help:        { type: "boolean", short: "h", default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    process.stdout.write(HELP + "\n");
    process.exit(0);
  }

  const jsonMode = values.json ?? false;
  const isTTY = process.stdout.isTTY === true;
  const forceInteractive = values.interactive ?? false;

  const llm = buildLLM();
  let planPath: string | undefined;
  let slug: string | undefined;
  let plan: ResearchPlan;

  try {
    if (values.dir) {
      // ── Directory batch mode ──────────────────────────────────────────────
      if (!values.slug) die(jsonMode, "--slug is required with --dir");
      slug = values.slug;
      log(jsonMode, `ingest: scanning ${values.dir} for .md/.pdf/.txt files …`);
      const result = await dirIngest({ dirPath: values.dir, slug, llm });
      plan = result.plan;
      planPath = result.outputPath;

    } else if (values.slug && values.objective) {
      // ── Headless agentic mode ─────────────────────────────────────────────
      slug = values.slug;
      log(jsonMode, `ingest: headless mode — slug=${slug}`);

      const files = values.files
        ? values.files.split(",").map((s: string) => s.trim()).filter(Boolean)
        : [];

      const sourcesBlock =
        files.length > 0
          ? ["sources:", ...files.map((f: string) => `  - "${f}"`)].join("\n")
          : "";

      const targetLine = values.target ? `target_hint: "${values.target}"` : "";

      const syntheticContent = [
        "---",
        `title: "${values.objective}"`,
        `slug: "${slug}"`,
        ...(targetLine ? [targetLine] : []),
        ...(sourcesBlock ? [sourcesBlock] : []),
        "---",
        "",
        "## research question",
        "",
        values.objective,
      ].join("\n");

      const result = await runIngest({
        inputPath: `headless-${slug}.md`,
        syntheticContent,
        slug,
        llm,
      });
      plan = result.plan;
      planPath = result.outputPath;

    } else if (forceInteractive || isTTY) {
      // ── Interactive interview ─────────────────────────────────────────────
      const result = await interviewIngest({
        prefill: {
          slug: values.slug,
          objective: values.objective,
          target: values.target,
        },
        llm,
      });
      plan = result.plan;
      planPath = result.outputPath;
      slug = plan.metadata.slug;

    } else {
      // ── Non-interactive, missing required flags ────────────────────────────
      die(
        jsonMode,
        "missing required flags: --slug and --objective (or use --interactive / run in a TTY)\n" +
          "Run `bun run ingest --help` for usage.",
      );
    }

    // ── Dogma Gate ────────────────────────────────────────────────────────────
    log(jsonMode, "ingest: running Dogma Gate …");
    const evalResult = evalPlanWithConfig(plan);

    if (!evalResult.pass) {
      if (planPath && existsSync(planPath)) {
        unlinkSync(planPath);
        log(jsonMode, `ingest: removed corrupted plan at ${planPath}`);
      }
      const failed = evalResult.dimensions
        .filter((d) => d.required && !d.pass)
        .map((d) => `  • [${d.id}] ${d.reason}`)
        .join("\n");
      die(jsonMode, `Dogma Gate failed:\n${failed}`);
    }

    log(jsonMode, `ingest: Dogma Gate passed (score ${Math.round(evalResult.score * 100)}%)`);

    // ── Final output ──────────────────────────────────────────────────────────
    if (jsonMode) {
      process.stdout.write(JSON.stringify({ ok: true, planPath, slug }) + "\n");
    } else {
      process.stdout.write(`\n  Mission plan ready: ${planPath}\n`);
      process.stdout.write(`  slug:      ${slug}\n`);
      process.stdout.write(`  objective: ${plan.objective}\n`);
      process.stdout.write(`  loadout:   ${plan.loadout}\n`);
      process.stdout.write(`\nNext: bun run dev start --plan ${planPath}\n`);
    }

    process.exit(0);
  } catch (err) {
    die(jsonMode, (err as Error).message);
  }
}

main();
