/**
 * Plan evaluator — runs a research plan against the configured dogma before
 * execution begins. Required dimensions block execution; advisory ones produce
 * warnings only.
 *
 * Usage:
 *   const result = evalPlan(plan, dogma);
 *   if (!result.pass) { printReport(result); process.exit(1); }
 */
import type { ResearchPlan } from "../ingest/schema.ts";
import { DEFAULT_DOGMA, buildDogma, type DogmaConfig, type DogmaDimension } from "../config/dogma.ts";

// ── types ─────────────────────────────────────────────────────────────────────

export interface DimensionResult {
  id: string;
  description: string;
  required: boolean;
  pass: boolean;
  reason: string;
}

export interface PlanEvalResult {
  /** True only when all required dimensions pass. */
  pass: boolean;
  /** Fraction of dimensions (required + advisory) that passed (0–1). */
  score: number;
  slug: string;
  objective: string;
  dimensions: DimensionResult[];
}

// ── evaluator ─────────────────────────────────────────────────────────────────

/**
 * Evaluate a research plan against a dogma set.
 * If `dogma` is omitted the default set is used.
 */
export function evalPlan(
  plan: ResearchPlan,
  dogma: DogmaDimension[] = DEFAULT_DOGMA,
): PlanEvalResult {
  const dimensions: DimensionResult[] = dogma.map((dim) => {
    const { pass, reason } = dim.check(plan);
    return { id: dim.id, description: dim.description, required: dim.required, pass, reason };
  });

  const requiredFailed = dimensions.filter((d) => d.required && !d.pass);
  const pass = requiredFailed.length === 0;
  const score = dimensions.filter((d) => d.pass).length / dimensions.length;

  return { pass, score, slug: plan.metadata.slug, objective: plan.objective, dimensions };
}

/** Build a dogma set from config and evaluate. */
export function evalPlanWithConfig(plan: ResearchPlan, cfg?: DogmaConfig): PlanEvalResult {
  return evalPlan(plan, buildDogma(cfg));
}

// ── report renderer ───────────────────────────────────────────────────────────

/** Human-readable Markdown report for terminal or log output. */
export function renderEvalReport(result: PlanEvalResult): string {
  const status = result.pass ? "✅ PASS" : "❌ FAIL";
  const pct = Math.round(result.score * 100);

  const lines = [
    `## Plan Eval: ${result.slug}`,
    `Objective: ${result.objective}`,
    `Status: ${status}  Score: ${pct}%`,
    "",
    "| Dimension | Required | Result | Reason |",
    "|-----------|----------|--------|--------|",
  ];

  for (const d of result.dimensions) {
    const req = d.required ? "required" : "advisory";
    const mark = d.pass ? "✅" : d.required ? "❌" : "⚠️";
    lines.push(`| ${d.id} | ${req} | ${mark} | ${d.reason} |`);
  }

  if (!result.pass) {
    const failed = result.dimensions.filter((d) => d.required && !d.pass);
    lines.push("");
    lines.push("**Blocked:** the following required dimensions failed:");
    for (const d of failed) lines.push(`  - **${d.id}**: ${d.reason}`);
    lines.push("");
    lines.push("Fix the research plan and re-run `bun run ingest` before starting a mission.");
  }

  return lines.join("\n");
}
