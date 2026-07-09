/**
 * Research dogma — epistemological standards every research plan must satisfy
 * before execution begins. These are not structural schema checks (Zod handles
 * that); they are quality gates that enforce research discipline.
 *
 * Each dimension is either `required` (blocks execution on failure) or advisory
 * (logged as a warning). The full set can be overridden via local.json
 * `dogma.dimensions` for project-specific standards.
 */
import type { ResearchPlan } from "../ingest/schema.ts";

// ── types ─────────────────────────────────────────────────────────────────────

export interface DogmaDimension {
  id: string;
  description: string;
  /** Required dimensions block execution on failure; advisory ones warn only. */
  required: boolean;
  check: (plan: ResearchPlan) => { pass: boolean; reason: string };
}

export interface DogmaConfig {
  /** Override specific dimensions by id (merged with defaults). */
  overrides?: Partial<Record<string, { required?: boolean }>>;
  /** Minimum score (0–1) across all dimensions before execution is allowed. */
  scoreThreshold?: number;
}

// ── dimension helpers ─────────────────────────────────────────────────────────

const VAGUE_VERBS = /^\s*(explore|understand|look at|examine|check|study)\b/i;
const MEASURABLE_WORDS = /\b(at least|exactly|n=|pass@|verify|confirm|measur|reproduc|count|percent|ratio|rate)\b/i;
const HONEST_PHASE_FRAGMENTS = /\b(real|true|actual|honest|complete|full)\b/i;
const DECEPTIVE_PHASE_WORDS = /\b(hide|obscure|without mentioning|bypass|route around|avoid disclos)\b/i;

// ── default dogma ─────────────────────────────────────────────────────────────

export const DEFAULT_DOGMA: DogmaDimension[] = [
  {
    id: "falsifiable-question",
    description: "Objective is specific and answerable — not vague exploration.",
    required: true,
    check(plan) {
      if (plan.objective.length < 25) {
        return { pass: false, reason: `objective too short (${plan.objective.length} chars < 25)` };
      }
      if (VAGUE_VERBS.test(plan.objective) && plan.objective.length < 60) {
        return {
          pass: false,
          reason: `objective starts with a vague verb and is not sufficiently specific`,
        };
      }
      return { pass: true, reason: "objective is specific and substantial" };
    },
  },

  {
    id: "bounded-scope",
    description: "Scope declares explicit in-bounds paths or hosts.",
    required: true,
    check(plan) {
      const hasPaths = plan.scope.paths.length > 0;
      const hasHosts = plan.scope.hosts.length > 0;
      if (!hasPaths && !hasHosts) {
        return {
          pass: false,
          reason: "scope.paths and scope.hosts are both empty — research has no bounded domain",
        };
      }
      return {
        pass: true,
        reason: `scope bounded: ${hasPaths ? `paths=${plan.scope.paths.join(",")}` : `hosts=${plan.scope.hosts.join(",")}`}`,
      };
    },
  },

  {
    id: "phased-approach",
    description: "Research is broken into at least two ordered phases.",
    required: true,
    check(plan) {
      if (plan.phases.length < 2) {
        return {
          pass: false,
          reason: `only ${plan.phases.length} phase(s) defined — depth requires ≥ 2 distinct phases`,
        };
      }
      return { pass: true, reason: `${plan.phases.length} phases defined` };
    },
  },

  {
    id: "measurable-success",
    description: "At least one success criterion is verifiable by a third party.",
    required: true,
    check(plan) {
      const measurable = plan.successCriteria.filter((c) => MEASURABLE_WORDS.test(c));
      if (measurable.length === 0) {
        return {
          pass: false,
          reason:
            "no success criterion contains measurable language (e.g. 'at least N', 'verify', 'pass@1', 'reproduce')",
        };
      }
      return { pass: true, reason: `${measurable.length} measurable criterion/criteria found` };
    },
  },

  {
    id: "source-grounded",
    description: "Research is grounded in at least one explicit source.",
    required: false,
    check(plan) {
      if (plan.sources.length === 0) {
        return {
          pass: false,
          reason: "no sources provided — research should cite at least one document or lesson",
        };
      }
      return { pass: true, reason: `${plan.sources.length} source(s) declared` };
    },
  },

  {
    id: "honest-decomposition",
    description: "Phase descriptions are complete and non-deceptive (invariant 7).",
    required: true,
    check(plan) {
      for (const phase of plan.phases) {
        if (DECEPTIVE_PHASE_WORDS.test(phase.description)) {
          return {
            pass: false,
            reason: `phase "${phase.id}" contains language suggesting hidden intent: "${phase.description.slice(0, 80)}"`,
          };
        }
      }
      return { pass: true, reason: "all phase descriptions appear truthful and complete" };
    },
  },

  {
    id: "specialist-alignment",
    description: "Each specialist has a focused role tied to the research question.",
    required: false,
    check(plan) {
      const unfocused = plan.specialists.filter((s) => s.focus.length < 10);
      if (unfocused.length > 0) {
        return {
          pass: false,
          reason: `${unfocused.length} specialist(s) have an under-specified focus (<10 chars)`,
        };
      }
      return { pass: true, reason: `${plan.specialists.length} specialist(s) have focused roles` };
    },
  },

  {
    id: "reproducible-criteria",
    description: "Success criteria do not rely solely on model self-report.",
    required: false,
    check(plan) {
      const selfReport = plan.successCriteria.filter((c) =>
        /\b(model says|agent claims|i believe|in my opinion|seems to)\b/i.test(c),
      );
      if (selfReport.length > 0) {
        return {
          pass: false,
          reason: "some success criteria rely on model self-report rather than external evidence",
        };
      }
      return { pass: true, reason: "success criteria reference external, observable evidence" };
    },
  },
];

// ── helpers ───────────────────────────────────────────────────────────────────

/** Merge default dogma with optional config overrides. */
export function buildDogma(cfg?: DogmaConfig): DogmaDimension[] {
  if (!cfg?.overrides) return DEFAULT_DOGMA;
  return DEFAULT_DOGMA.map((dim) => {
    const override = cfg.overrides![dim.id];
    if (!override) return dim;
    return { ...dim, required: override.required ?? dim.required };
  });
}
