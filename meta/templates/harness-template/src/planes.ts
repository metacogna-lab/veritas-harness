/**
 * The eight orthogonal planes this harness composes, and the module that owns
 * each. Mixing these concerns is the primary cause of unmaintainable agent
 * frameworks, so the boundary is stated here explicitly and asserted by
 * planes.test.ts. Add capability by registering a new Tool/specialist — never by
 * folding a second concern into one of these modules.
 */
export const PLANES = {
  provider: { module: "src/llm", role: "Single complete() interface; fallback, token accounting, tool shim." },
  safety: { module: "src/safety", role: "Pure scope/approval/human-release gates. Deny by default." },
  verification: { module: "src/evidence", role: "Evidence gate + adversarial refuter. Provenance before claim." },
  memory: { module: "src/mission (+ src/memory)", role: "Durable append-only ledger; ephemeral windowed context." },
  capability: { module: "src/tools", role: "Typed, schema-validated, risk-tiered tool registry." },
  execution: { module: "src/agent", role: "The ReAct loop; hard ceilings; every call through the gate." },
  orchestration: { module: "src/orchestration", role: "Honest decomposition into worker sub-tasks (roadmap in template)." },
  control: { module: "src/cli", role: "Mission lifecycle, NL intake, cost aggregation, reporting." },
} as const;

export type PlaneName = keyof typeof PLANES;
