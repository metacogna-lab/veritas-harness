/**
 * Source digest — read plan sources (markdown + PDF), generate per-source
 * summaries, and synthesise them into resources/summary/<slug>/.
 *
 * Flow:
 *   digestSources(plan, opts)
 *     → readSource(path)          — extract text from .md or .pdf
 *     → summariseSource(text, ...) — LLM call: what does this say re. objective?
 *     → write resources/summary/<slug>/<basename>.md
 *     → synthesise(summaries, ...) — LLM call: alignment + tensions
 *     → write resources/summary/<slug>/synthesis.md
 *
 * Idempotent: skips sources whose summary already exists unless force=true.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, basename, extname } from "node:path";
import type { ResearchPlan, PlanSource } from "../ingest/schema.ts";
import type { LLMBackbone } from "../llm/index.ts";

// ── types ─────────────────────────────────────────────────────────────────────

export interface DigestOptions {
  plan: ResearchPlan;
  /** Root of the harness (where resources/ lives). */
  harnessRoot: string;
  llm: LLMBackbone;
  /** Re-generate even if summary already exists. */
  force?: boolean;
  /** Sink for progress lines. */
  onEvent?: (line: string) => void;
}

export interface SourceSummary {
  source: PlanSource;
  summaryPath: string;
  skipped: boolean;
  text: string;
}

export interface DigestResult {
  slug: string;
  summaryDir: string;
  sources: SourceSummary[];
  synthesisPath: string;
}

// ── text extraction ───────────────────────────────────────────────────────────

/** Extract readable text from a source file. */
function readSource(absPath: string): string {
  const ext = extname(absPath).toLowerCase();

  if (ext === ".md" || ext === ".txt") {
    return readFileSync(absPath, "utf8");
  }

  if (ext === ".pdf") {
    return extractPdfText(absPath);
  }

  // Best-effort: try reading as UTF-8
  try {
    const raw = readFileSync(absPath, "utf8");
    if (raw.length > 0 && !raw.includes("\x00")) return raw;
  } catch {
    // fall through
  }

  return `[source at ${absPath} is not readable as text — convert to .md for full digest]`;
}

/**
 * Lightweight PDF text extraction without external deps.
 * Reads raw PDF bytes, locates BT/ET text blocks, strips operators.
 * Sufficient for text-based PDFs; returns a stub for binary-only PDFs.
 */
function extractPdfText(absPath: string): string {
  try {
    const bytes = readFileSync(absPath);
    const raw = bytes.toString("latin1");

    // Extract text between BT ... ET blocks (PDF text objects)
    const textBlocks: string[] = [];
    const btEt = /BT([\s\S]*?)ET/g;
    let m: RegExpExecArray | null;
    while ((m = btEt.exec(raw)) !== null) {
      const block = m[1];
      if (block === undefined) continue;
      // Extract string literals: (text) or <hex>
      const literals = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
      let t: RegExpExecArray | null;
      while ((t = literals.exec(block)) !== null) {
        const literal = t[1];
        if (literal === undefined) continue;
        const decoded = literal
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\\\/g, "\\")
          .replace(/\\\(/g, "(")
          .replace(/\\\)/g, ")");
        if (decoded.trim().length > 0) textBlocks.push(decoded);
      }
    }

    const extracted = textBlocks.join(" ").replace(/\s+/g, " ").trim();
    if (extracted.length > 50) return extracted;
  } catch {
    // fall through
  }

  return `[PDF at ${absPath} — text extraction incomplete; convert to .md for full digest]`;
}

// ── LLM prompts ───────────────────────────────────────────────────────────────

async function summariseSource(
  text: string,
  source: PlanSource,
  objective: string,
  llm: LLMBackbone,
): Promise<string> {
  const truncated = text.length > 8000 ? text.slice(0, 8000) + "\n\n[... truncated ...]" : text;

  const prompt = [
    `You are summarising a research source in the context of a specific research objective.`,
    ``,
    `Research objective: ${objective}`,
    `Source kind: ${source.kind}`,
    `Source path: ${source.path}`,
    ``,
    `Produce a focused summary (200–400 words) that answers:`,
    `1. What does this source claim or show?`,
    `2. How does it support, challenge, or refine the research objective?`,
    `3. What key concepts, data, or evidence does it contribute?`,
    ``,
    `Do not speculate beyond what the source says. Label gaps explicitly.`,
    ``,
    `SOURCE TEXT:`,
    truncated,
  ].join("\n");

  const response = await llm.complete({ messages: [{ role: "user", content: prompt }] });
  return response.text.trim();
}

async function synthesiseSources(
  summaries: Array<{ source: PlanSource; summary: string }>,
  objective: string,
  llm: LLMBackbone,
): Promise<string> {
  const sourceDump = summaries
    .map(({ source, summary }) => `### ${source.path} (${source.kind})\n${summary}`)
    .join("\n\n---\n\n");

  const prompt = [
    `You are synthesising multiple research sources to map alignment and tensions.`,
    ``,
    `Research objective: ${objective}`,
    ``,
    `Produce a synthesis (300–600 words) structured as:`,
    ``,
    `## Aligned with research objective`,
    `[What the sources agree on, or that directly supports the objective]`,
    ``,
    `## Tensions and gaps`,
    `[Where sources disagree, contradict each other, or leave questions unanswered]`,
    ``,
    `## Key concepts`,
    `[Shared vocabulary, frameworks, or data points across sources]`,
    ``,
    `## Implications for the research`,
    `[What the synthesis means for how the research should proceed]`,
    ``,
    `Base everything on the source summaries below. Do not speculate.`,
    ``,
    `SOURCE SUMMARIES:`,
    sourceDump,
  ].join("\n");

  const response = await llm.complete({ messages: [{ role: "user", content: prompt }] });
  return response.text.trim();
}

// ── writer ────────────────────────────────────────────────────────────────────

function summaryPath(summaryDir: string, source: PlanSource): string {
  const base = basename(source.path).replace(/\.(pdf|md|txt)$/i, "");
  return join(summaryDir, `${base}.md`);
}

function writeSummary(path: string, source: PlanSource, summary: string, objective: string): void {
  const content = [
    `# Source Summary: ${basename(source.path)}`,
    ``,
    `**Kind:** ${source.kind}  `,
    `**Path:** \`${source.path}\`  `,
    `**Research objective:** ${objective}`,
    ``,
    `---`,
    ``,
    summary,
    ``,
  ].join("\n");
  writeFileSync(path, content, "utf8");
}

function writeSynthesis(path: string, synthesis: string, objective: string, slug: string): void {
  const content = [
    `# Source Synthesis: ${slug}`,
    ``,
    `**Research objective:** ${objective}`,
    ``,
    `---`,
    ``,
    synthesis,
    ``,
  ].join("\n");
  writeFileSync(path, content, "utf8");
}

// ── main export ───────────────────────────────────────────────────────────────

/** Digest all plan sources, writing summaries and a synthesis to resources/summary/<slug>/. */
export async function digestSources(opts: DigestOptions): Promise<DigestResult> {
  const { plan, harnessRoot, llm, force = false, onEvent = () => {} } = opts;
  const { slug } = plan.metadata;
  const summaryDir = join(harnessRoot, "resources", "summary", slug);

  mkdirSync(summaryDir, { recursive: true });

  const sourceSummaries: Array<{ source: PlanSource; summary: string }> = [];
  const sourceMeta: SourceSummary[] = [];

  // Filter to doc/resource/download kinds (lessons are recorded separately)
  const digestible = plan.sources.filter((s) => s.kind !== "lesson");

  for (const source of digestible) {
    const outPath = summaryPath(summaryDir, source);
    const absSourcePath = join(harnessRoot, source.path);

    if (!force && existsSync(outPath)) {
      onEvent(`digest: skip ${source.path} (summary exists)`);
      const existingText = readFileSync(outPath, "utf8");
      sourceSummaries.push({ source, summary: existingText });
      sourceMeta.push({ source, summaryPath: outPath, skipped: true, text: existingText });
      continue;
    }

    if (!existsSync(absSourcePath)) {
      const stub = `[source not found on disk: ${source.path}]`;
      onEvent(`digest: warn — source not found: ${source.path}`);
      sourceSummaries.push({ source, summary: stub });
      sourceMeta.push({ source, summaryPath: outPath, skipped: false, text: stub });
      writeSummary(outPath, source, stub, plan.objective);
      continue;
    }

    onEvent(`digest: reading ${source.path}`);
    const text = readSource(absSourcePath);

    onEvent(`digest: summarising ${source.path}`);
    const summary = await summariseSource(text, source, plan.objective, llm);
    writeSummary(outPath, source, summary, plan.objective);
    onEvent(`digest: wrote ${outPath}`);

    sourceSummaries.push({ source, summary });
    sourceMeta.push({ source, summaryPath: outPath, skipped: false, text: summary });
  }

  // Synthesis
  const synthesisFilePath = join(summaryDir, "synthesis.md");
  const skipSynthesis = !force && existsSync(synthesisFilePath) && sourceSummaries.every((s, i) => sourceMeta[i]?.skipped);

  if (!skipSynthesis && sourceSummaries.length > 0) {
    onEvent(`digest: synthesising ${sourceSummaries.length} source(s)`);
    const synthesis = await synthesiseSources(sourceSummaries, plan.objective, llm);
    writeSynthesis(synthesisFilePath, synthesis, plan.objective, slug);
    onEvent(`digest: wrote synthesis → ${synthesisFilePath}`);
  } else if (sourceSummaries.length === 0) {
    const stub = `# Source Synthesis: ${slug}\n\nNo digestible sources declared in research plan.\n`;
    writeFileSync(synthesisFilePath, stub, "utf8");
  } else {
    onEvent(`digest: skip synthesis (all sources cached, use --force to regenerate)`);
  }

  return { slug, summaryDir, sources: sourceMeta, synthesisPath: synthesisFilePath };
}
