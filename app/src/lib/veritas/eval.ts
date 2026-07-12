/**
 * Plan evaluator — runs a research plan against the dogma before execution.
 * Copied from harness/veritas-example/src/resources/plan-eval.ts (adjusted imports).
 */
import type { ResearchPlan } from "./schema";
import { DEFAULT_DOGMA, buildDogma, type DogmaConfig, type DogmaDimension } from "./dogma";

export interface DimensionResult {
  id: string;
  description: string;
  required: boolean;
  pass: boolean;
  reason: string;
}

export interface PlanEvalResult {
  pass: boolean;
  score: number;
  slug: string;
  objective: string;
  dimensions: DimensionResult[];
}

export function evalPlan(
  plan: ResearchPlan,
  dogma: DogmaDimension[] = DEFAULT_DOGMA,
): PlanEvalResult {
  const dimensions: DimensionResult[] = dogma.map((dim) => {
    const { pass, reason } = dim.check(plan);
    return { id: dim.id, description: dim.description, required: dim.required, pass, reason };
  });
  const pass = dimensions.filter((d) => d.required && !d.pass).length === 0;
  const score = dimensions.filter((d) => d.pass).length / dimensions.length;
  return { pass, score, slug: plan.metadata.slug, objective: plan.objective, dimensions };
}

export function evalPlanWithConfig(plan: ResearchPlan, cfg?: DogmaConfig): PlanEvalResult {
  return evalPlan(plan, buildDogma(cfg));
}
