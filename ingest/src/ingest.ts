/**
 * Ingest orchestrator — sanitize, parse, fit via LLM, validate, write research-plan.json.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadConfig, providerConfig } from "../../harness/veritas-research/src/config/index.ts";
import { LLMBackbone } from "../../harness/veritas-research/src/llm/index.ts";
import type { LLMBackboneOptions } from "../../harness/veritas-research/src/llm/index.ts";
import { parseIntentFile } from "./parse-intent.ts";
import { buildResourcesCatalog, defaultRepoRoot } from "./resources-catalog.ts";
import { fitIntent } from "./fit-intent.ts";
import type { ResearchPlan } from "./schema.ts";

export interface IngestOptions {
  inputPath: string;
  slug?: string;
  repoRoot?: string;
  outputDir?: string;
  llm?: LLMBackbone;
  dryRun?: boolean;
}

export interface IngestResult {
  plan: ResearchPlan;
  outputPath: string;
}

/** Resolve output path under harness/veritas-research/missions/<slug>/. */
export function missionOutputPath(repoRoot: string, slug: string): string {
  return join(repoRoot, "harness/veritas-research/missions", slug, "research-plan.json");
}

/** Build default LLM from harness config. */
export function buildIngestLLM(opts?: Partial<LLMBackboneOptions>): LLMBackbone {
  const config = loadConfig();
  const primary = providerConfig(config);
  if (!primary) throw new Error("no provider configured for ingest");
  return new LLMBackbone({
    configs: config.providers.length > 0 ? config.providers : [primary],
    ...opts,
  });
}

/** Run the full ingest pipeline. */
export async function runIngest(opts: IngestOptions): Promise<IngestResult> {
  const repoRoot = opts.repoRoot ?? defaultRepoRoot();
  const inputPath = resolve(opts.inputPath);
  const raw = readFileSync(inputPath, "utf8");
  const intent = parseIntentFile(raw, inputPath);
  const slug = opts.slug ?? intent.frontmatter.slug;

  const objective =
    intent.sections.question ??
    intent.sections["research question"] ??
    intent.frontmatter.title;

  const catalog = buildResourcesCatalog({
    repoRoot,
    objective,
    extraSources: intent.frontmatter.sources,
  });

  const llm = opts.llm ?? buildIngestLLM();
  const primary = loadConfig();
  const cfg = providerConfig(primary);
  const modelLabel = cfg ? `${cfg.provider}/${cfg.model}` : "unknown";

  const plan = await fitIntent({
    intent,
    catalog,
    llm,
    modelLabel,
  });

  const outputPath = opts.outputDir
    ? join(opts.outputDir, "research-plan.json")
    : missionOutputPath(repoRoot, slug);

  if (!opts.dryRun) {
    mkdirSync(join(outputPath, ".."), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(plan, null, 2), "utf8");
  }

  return { plan, outputPath };
}
