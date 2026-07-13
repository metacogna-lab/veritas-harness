/**
 * Telemetry event contract (veritas-v0.2 H-5 / W4) — the inner→outer interface.
 *
 * The inner loop (missions) EMITS these; the outer loop (RSI) and the UI READ them.
 * Each event is a flat, self-describing record (no nesting beyond one level) so a line
 * of NDJSON is meaningful on its own and cheap to ingest. Raw tool outputs and model
 * completions are NEVER carried here — only structured, auditable facts.
 */

export type HarnessEvent =
  | { kind: "mission.start"; missionId: string; slug: string; objective: string }
  | { kind: "mission.end"; missionId: string; status: "ok" | "error"; durationMs: number }
  | { kind: "step.execute"; missionId: string; step: number; tool: string; riskTier: string }
  | { kind: "step.observe"; missionId: string; step: number; ok: boolean }
  | { kind: "tool.scope_deny"; missionId: string; tool: string; reason: string }
  | { kind: "tool.gate_deny"; missionId: string; tool: string; tier: string }
  | { kind: "finding.proposed"; missionId: string; findingId: string }
  | { kind: "finding.refuted"; missionId: string; findingId: string; reason: string }
  | { kind: "finding.confirmed"; missionId: string; findingId: string }
  | { kind: "ingest.gate_pass"; slug: string; score: number }
  | { kind: "ingest.gate_fail"; slug: string; errors: string[] }
  | { kind: "provider.error"; provider: string; error: string };

export type HarnessEventKind = HarnessEvent["kind"];

/** Severity mapping for structured log lines. */
export const EVENT_LEVEL: Record<HarnessEventKind, "debug" | "info" | "warn" | "error"> = {
  "mission.start": "info",
  "mission.end": "info",
  "step.execute": "info",
  "step.observe": "info",
  "tool.scope_deny": "warn",
  "tool.gate_deny": "warn",
  "finding.proposed": "info",
  "finding.refuted": "warn",
  "finding.confirmed": "info",
  "ingest.gate_pass": "info",
  "ingest.gate_fail": "warn",
  "provider.error": "error",
};

/** Per-mission counters derived from the event stream. Consumed by RSI + verify-claims + UI. */
export interface MissionMetrics {
  missionId: string;
  slug: string;
  durationMs: number;
  steps: number;
  scopeDenials: number;
  gateDenials: number;
  findings: { proposed: number; refuted: number; confirmed: number };
  providerErrors: number;
}
