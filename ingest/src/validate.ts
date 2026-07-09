/**
 * Validate LLM output against ResearchPlan schema with Zod.
 */
import { parseLastObject } from "../../harness/veritas-research/src/parse/json.ts";
import { researchPlanSchema, type ResearchPlan } from "./schema.ts";
import type { ZodError } from "zod";

export interface ValidateResult {
  ok: true;
  plan: ResearchPlan;
}

export interface ValidateError {
  ok: false;
  error: string;
  zodError?: ZodError;
}

/** Parse raw LLM text and validate against ResearchPlan schema. */
export function validateResearchPlan(text: string): ValidateResult | ValidateError {
  const obj = parseLastObject(text);
  if (!obj) return { ok: false, error: "no JSON object found in LLM output" };

  const parsed = researchPlanSchema.safeParse(obj);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.message, zodError: parsed.error };
  }
  return { ok: true, plan: parsed.data };
}

/** Format Zod errors for LLM retry prompt. */
export function formatValidationErrors(result: ValidateError): string {
  return result.zodError?.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n") ?? result.error;
}
