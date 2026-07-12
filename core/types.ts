/**
 * API contract types for the Veritas web interface.
 */
import type { ResearchPlan } from "./schema";
import type { DimensionResult } from "./eval";

export type { ResearchPlan, DimensionResult };

export interface MissionPayload {
  slug: string;
  objective: string;
  target?: string;
  loadout?: "codebase-audit" | "research" | "web-recon";
  fileContent?: string;
  fileName?: string;
}

export interface ApiIngestSuccess {
  ok: true;
  slug: string;
  plan: ResearchPlan;
  score: number;
  dimensions: DimensionResult[];
}

export interface ApiIngestError {
  ok: false;
  error: string;
  violations?: DimensionResult[];
}

export type ApiIngestResult = ApiIngestSuccess | ApiIngestError;
