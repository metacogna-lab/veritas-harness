/**
 * Memory plane (durable ledger) — the Mission object.
 *
 * Append-only transcript of tool observations plus a findings list. Nothing is
 * mutated after write: each recorded observation is frozen, and getters return
 * copies. Findings route through the evidence gate before they are accepted
 * (invariant #3). The ephemeral, windowed context sent to the model is a
 * separate concern (a real harness adds it as memory/context-window).
 */
import type { MissionScope } from "../safety/scope.ts";
import { evidenceGate, type FindingDraft, type GateDecision } from "../evidence/gate.ts";

export interface Observation {
  toolName: string;
  input: unknown;
  observation: string;
  ok: boolean;
  at: string;
}

export interface Finding {
  id: string;
  claim: string;
  evidenceRef: string;
  status: "proposed" | "confirmed" | "retracted";
}

export class Mission {
  readonly objective: string;
  readonly scope: MissionScope;
  private readonly _log: Observation[] = [];
  private readonly _findings: Finding[] = [];

  constructor(objective: string, scope: MissionScope) {
    this.objective = objective;
    this.scope = scope;
  }

  /** Append a tool observation (frozen on write — the ledger is immutable after write). */
  record(observation: Observation): void {
    this._log.push(Object.freeze({ ...observation }));
  }

  get log(): readonly Observation[] {
    return [...this._log];
  }

  /**
   * Propose a finding. It is accepted (status "proposed") only if the evidence
   * gate confirms a real observation backs it; otherwise it is rejected.
   */
  addFinding(draft: FindingDraft): GateDecision {
    const decision = evidenceGate(draft, this._log);
    if (!decision.ok) return decision;
    this._findings.push(
      Object.freeze({ id: `f${this._findings.length + 1}`, claim: draft.claim, evidenceRef: draft.evidenceRef, status: "proposed" }),
    );
    return { ok: true };
  }

  get findings(): readonly Finding[] {
    return [...this._findings];
  }
}
