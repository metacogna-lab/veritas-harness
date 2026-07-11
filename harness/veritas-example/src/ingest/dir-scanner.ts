/**
 * Directory scanner — walks a folder, stages files as symlinks, builds a
 * synthetic research-plan via the standard ingest pipeline.
 */
import { readdirSync, symlinkSync, mkdirSync } from "node:fs";
import { join, resolve, extname } from "node:path";
import { runIngest } from "./ingest.ts";
import { defaultHarnessRoot } from "./resources-catalog.ts";
import type { IngestResult } from "./ingest.ts";
import type { LLMBackbone } from "../llm/index.ts";

export interface DirScanOptions {
  dirPath: string;
  slug: string;
  harnessRoot?: string;
  llm?: LLMBackbone;
  dryRun?: boolean;
}

const VALID_EXTS = new Set([".md", ".pdf", ".txt"]);

export function walkDir(dirPath: string): string[] {
  const abs = resolve(dirPath);
  const results: string[] = [];
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    const full = join(abs, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else if (VALID_EXTS.has(extname(entry.name).toLowerCase())) {
      results.push(full);
    }
  }
  return results;
}

export function stageFiles(files: string[], slug: string, harnessRoot: string): string[] {
  const rawDir = join(harnessRoot, "research", "raw", slug);
  mkdirSync(rawDir, { recursive: true });
  const staged: string[] = [];
  for (const src of files) {
    const name = src.split("/").pop()!;
    const dest = join(rawDir, name);
    try {
      symlinkSync(src, dest);
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    staged.push(dest);
  }
  return staged;
}

export async function dirIngest(opts: DirScanOptions): Promise<IngestResult> {
  const harnessRoot = opts.harnessRoot ?? defaultHarnessRoot();
  const files = walkDir(opts.dirPath);
  if (files.length === 0) {
    throw new Error(`no .md/.pdf/.txt files found in ${opts.dirPath}`);
  }

  const staged = stageFiles(files, opts.slug, harnessRoot);

  const sourcesYaml = staged.map((p) => `  - "${p}"`).join("\n");
  const syntheticContent = [
    "---",
    `title: "${opts.slug}"`,
    `slug: "${opts.slug}"`,
    "sources:",
    sourcesYaml,
    "---",
    "",
    "## research question",
    "",
    `Analyze and synthesize the documents staged from ${opts.dirPath}.`,
  ].join("\n");

  return runIngest({
    inputPath: join(harnessRoot, "research", "raw", opts.slug, "AUTO_NEW.md"),
    syntheticContent,
    slug: opts.slug,
    harnessRoot,
    llm: opts.llm,
    dryRun: opts.dryRun,
  });
}
