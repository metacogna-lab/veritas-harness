/**
 * ResearchPlan schema — single source of truth for ingest output and harness consumption.
 */
import { z } from "zod";

export const INGEST_VERSION = "0.1.0";

export const missionScopeSchema = z.object({
  hosts: z.array(z.string()),
  paths: z.array(z.string()),
  allowLoopback: z.boolean().optional(),
  allowPrivate: z.boolean().optional(),
  allowShell: z.boolean().optional(),
});

export const planSpecialistSchema = z.object({
  role: z.string().min(1),
  focus: z.string().min(1),
});

export const planPhaseSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
});

export const planSourceSchema = z.object({
  kind: z.enum(["lesson", "doc", "resource", "download"]),
  path: z.string().min(1),
});

export const planBenchmarkSchema = z.object({
  suite: z.string().min(1),
  mode: z.enum(["black", "white"]),
});

export const planMetadataSchema = z.object({
  slug: z.string().min(1),
  ingestedAt: z.string().min(1),
  ingestVersion: z.string().min(1),
  model: z.string().min(1),
});

export const researchPlanSchema = z.object({
  version: z.literal("1"),
  metadata: planMetadataSchema,
  objective: z.string().min(1),
  loadout: z.string().min(1),
  target: z.string().min(1),
  scope: missionScopeSchema,
  specialists: z.array(planSpecialistSchema).min(1),
  phases: z.array(planPhaseSchema).min(1),
  sources: z.array(planSourceSchema),
  lessons: z.array(z.string()),
  successCriteria: z.array(z.string().min(1)).min(1),
  benchmark: planBenchmarkSchema.optional(),
});

export type ResearchPlan = z.infer<typeof researchPlanSchema>;
export type ParsedResearchPlan = ResearchPlan;
