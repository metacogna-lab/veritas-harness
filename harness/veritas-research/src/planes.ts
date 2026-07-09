/**
 * The eight orthogonal planes this harness composes, and the module(s) that own
 * each. Mixing these concerns is the primary cause of unmaintainable agent
 * frameworks, so the boundary is stated here and asserted by planes.test.ts.
 *
 * Add capability by registering a new Tool/specialist/loadout — never by folding a
 * second plane's concern into one of these modules (invariant #8: compose, don't
 * fork). See agents/plans/08-eight-plane-and-rsi.md for the full rationale.
 */
export interface PlaneSpec {
  /** One-line responsibility. */
  role: string;
  /** Representative source path(s) that implement the plane. */
  modules: string[];
}

export const PLANES = {
  provider: {
    role: "Single complete() interface; provider+local fallback chain, token accounting, text-mode tool shim.",
    modules: ["src/llm/index.ts", "src/llm/types.ts"],
  },
  safety: {
    role: "Pure, I/O-free gates: scope containment, risk-tier approval, human-release. Deny by default.",
    modules: ["src/safety/scope.ts", "src/safety/approval.ts", "src/safety/human-release.ts", "src/safety/index.ts"],
  },
  verification: {
    role: "Evidence gate (provenance before claim) + adversarial refuter (refute before confirm).",
    modules: ["src/evidence/gate.ts", "src/evidence/refuter.ts"],
  },
  memory: {
    role: "Durable append-only ledger (Mission) + ephemeral windowed context (rolling summary/scratchpad).",
    modules: ["src/mission/index.ts", "src/memory/context-window.ts"],
  },
  capability: {
    role: "Typed tool registry: schema-validated at the boundary, strict risk tiers.",
    modules: ["src/tools/registry.ts"],
  },
  execution: {
    role: "The ReAct loop; hard step/token ceilings; every tool call routes through the safety gate.",
    modules: ["src/agent/index.ts"],
  },
  orchestration: {
    role: "Honest decomposition into worker sub-tasks; round-based synthesis. Never hides task shape.",
    modules: ["src/orchestration/orchestrator.ts"],
  },
  control: {
    role: "Mission lifecycle, NL intake, cost aggregation, reporting.",
    modules: ["src/control/plane.ts", "src/cli.ts"],
  },
} as const satisfies Record<string, PlaneSpec>;

export type PlaneName = keyof typeof PLANES;

export const PLANE_NAMES = Object.keys(PLANES) as PlaneName[];
