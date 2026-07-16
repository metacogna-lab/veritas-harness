/** Mission data types. */
import type { MissionScope } from "../safety/scope.ts";

export type MissionStatus = "created" | "running" | "done" | "error";

export type TranscriptKind =
  | "objective"
  | "model"
  | "tool_call"
  | "observation"
  | "note"
  | "status";

/** One append-only transcript entry. Frozen after write — never mutated. */
export interface TranscriptEntry {
  readonly seq: number;
  readonly timestamp: string;
  readonly kind: TranscriptKind;
  readonly content: string;
  readonly meta?: Readonly<Record<string, unknown>>;
}

export type FindingStatus = "proposed" | "confirmed" | "retracted";

/**
 * Provenance ties a finding to the real tool observation that produced it.
 * `observationSeq` is the transcript seq of the observation entry; the evidence
 * gate (INT 2.3) rejects any finding whose provenance does not match a real
 * observation in the log.
 */
export interface FindingProvenance {
  readonly toolCall: string;
  readonly observationSeq: number;
}

export interface Finding {
  readonly id: string;
  readonly claim: string;
  readonly provenance: FindingProvenance;
  readonly status: FindingStatus;
  readonly createdAt: string;
  /** Set when the refuter (INT 2.4) retracts or confirms. */
  readonly refutation?: string;
}

export interface MissionSnapshot {
  readonly id: string;
  readonly objective: string;
  readonly scope: MissionScope;
  readonly status: MissionStatus;
  readonly transcript: readonly TranscriptEntry[];
  readonly findings: readonly Finding[];
}
