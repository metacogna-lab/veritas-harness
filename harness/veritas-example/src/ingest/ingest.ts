/**
 * Ingest orchestrator — sanitize, parse, fit via LLM, validate, write research-plan.json.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, providerChain } from "@spine/config/index.ts";
import { LLMBackbone } from "@spine/llm/index.ts";
import type { LLMBackboneOptions } from "@spine/llm/index.ts";
import { parseIntentFile } from "./parse-intent.ts";
import { buildResourcesCatalog, defaultHarnessRoot } from "./resources-catalog.ts";
import { fitIntent } from "./fit-intent.ts";
import type { ResearchPlan } from "./schema.ts";

export interface IngestOptions {
  inputPath: string;
  /** Pre-built NEW.md content — skips readFileSync when provided. */
  syntheticContent?: string;
  slug?: string;
  harnessRoot?: string;
  outputDir?: string;
  llm?: LLMBackbone;
  dryRun?: boolean;
}

export interface IngestResult {
  plan: ResearchPlan;
  outputPath: string;
}

/** Resolve output path under missions/<slug>/research-plan.json. */
export function missionOutputPath(harnessRoot: string, slug: string): string {
  return join(harnessRoot, "missions", slug, "research-plan.json");
}

/** Build default LLM from harness config. */
export function buildIngestLLM(opts?: Partial<LLMBackboneOptions>): LLMBackbone {
  const config = loadConfig();
  const chain = providerChain(config);
  if (chain.length === 0) throw new Error("no provider configured for ingest");
  return new LLMBackbone({
    configs: chain,
    ...opts,
  });
}

/** Run the full ingest pipeline. */
export async function runIngest(opts: IngestOptions): Promise<IngestResult> {
  const harnessRoot = opts.harnessRoot ?? defaultHarnessRoot();
  const inputPath = resolve(opts.inputPath);
  const raw = opts.syntheticContent ?? readFileSync(inputPath, "utf8");
  const intent = parseIntentFile(raw, inputPath);
  const slug = opts.slug ?? intent.frontmatter.slug;

  const objective =
    intent.sections.question ??
    intent.sections["research question"] ??
    intent.frontmatter.title;

  const catalog = buildResourcesCatalog({
    harnessRoot,
    objective,
    extraSources: intent.frontmatter.sources,
  });

  const llm = opts.llm ?? buildIngestLLM();
  const primary = loadConfig();
  const cfg = providerChain(primary)[0];
  const modelLabel = cfg ? `${cfg.provider}/${cfg.model}` : "unknown";

  const plan = await fitIntent({
    intent,
    catalog,
    llm,
    modelLabel,
  });

  const outputPath = opts.outputDir
    ? join(opts.outputDir, "research-plan.json")
    : missionOutputPath(harnessRoot, slug);

  if (!opts.dryRun) {
    mkdirSync(join(outputPath, ".."), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(plan, null, 2), "utf8");
  }

  return { plan, outputPath };
}
