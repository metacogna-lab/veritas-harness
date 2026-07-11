/**
 * Interactive interview — prompts a human operator for mission details and
 * delegates to runIngest or dirIngest.
 */
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { existsSync } from "node:fs";
import { runIngest } from "./ingest.ts";
import { dirIngest } from "./dir-scanner.ts";
import type { IngestResult } from "./ingest.ts";
import type { LLMBackbone } from "../llm/index.ts";

export interface InterviewOptions {
  prefill?: {
    slug?: string;
    objective?: string;
    target?: string;
  };
  llm?: LLMBackbone;
  dryRun?: boolean;
}

export async function interviewIngest(opts: InterviewOptions = {}): Promise<IngestResult> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const ask = (q: string) => rl.question(q);

  try {
    stdout.write("\nVeritas Ingest — Interactive Interview\n");
    stdout.write("─────────────────────────────────────\n\n");

    const slug =
      opts.prefill?.slug ?? (await ask("Mission slug (e.g. auth-audit): ")).trim();
    if (!slug) throw new Error("slug is required");

    const objective =
      opts.prefill?.objective ?? (await ask("Mission objective: ")).trim();
    if (!objective) throw new Error("objective is required");

    const target =
      opts.prefill?.target ?? (await ask("Target path or scope boundary: ")).trim();

    const dirAnswer = (
      await ask("Batch-ingest a folder of context docs? (path or leave blank): ")
    ).trim();

    if (dirAnswer) {
      if (!existsSync(dirAnswer)) throw new Error(`directory not found: ${dirAnswer}`);
      return await dirIngest({ dirPath: dirAnswer, slug, llm: opts.llm, dryRun: opts.dryRun });
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

    return await runIngest({
      inputPath: `interview-${slug}.md`,
      syntheticContent,
      slug,
      llm: opts.llm,
      dryRun: opts.dryRun,
    });
  } finally {
    rl.close();
  }
}
