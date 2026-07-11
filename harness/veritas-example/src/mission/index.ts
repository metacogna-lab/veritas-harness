/**
 * The Mission object — the control-plane record for one agent run.
 *
 * Holds the objective, scope, status, an APPEND-ONLY transcript, and findings.
 * Invariants:
 *   - Every entry is deeply frozen at write time; nothing is ever mutated after
 *     write (immutability rule + append-only log semantics).
 *   - `record()` and `addFinding()` only ever append; they never rewrite or
 *     delete existing entries.
 *   - `snapshot()` returns a serializable, frozen copy safe to hand anywhere.
 *
 * A `findingValidator` seam lets INT 2.3 inject the evidence gate without
 * touching the loop: the default validator accepts everything, so BASIC behaves
 * as a plain append.
 */
import type { MissionScope } from "../safety/scope.ts";
import type {
  Finding,
  FindingProvenance,
  FindingStatus,
  MissionSnapshot,
  MissionStatus,
  TranscriptEntry,
  TranscriptKind,
} from "./types.ts";

export * from "./types.ts";

/** Decision returned by a finding validator (INT 2.3 provenance gate). */
export type FindingDecision = { accepted: true } | { accepted: false; reason: string };

export type FindingValidator = (
  finding: Finding,
  transcript: readonly TranscriptEntry[],
) => FindingDecision;

const acceptAll: FindingValidator = () => ({ accepted: true });

export interface MissionOptions {
  id?: string;
  objective: string;
  scope: MissionScope;
  /** Injectable clock for deterministic tests. */
  now?: () => string;
  /** Injectable id generator for findings/mission. */
  idGen?: () => string;
  /** Injected in INT 2.3; defaults to accept-all in BASIC. */
  findingValidator?: FindingValidator;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

export interface AddFindingInput {
  claim: string;
  provenance: FindingProvenance;
  status?: FindingStatus;
}

export type AddFindingResult =
  | { accepted: true; finding: Finding }
  | { accepted: false; reason: string };

export class Mission {
  readonly id: string;
  readonly objective: string;
  readonly scope: MissionScope;
  private _status: MissionStatus = "created";
  private readonly _transcript: TranscriptEntry[] = [];
  private readonly _findings: Finding[] = [];
  private seq = 0;
  private readonly now: () => string;
  private readonly idGen: () => string;
  private readonly validate: FindingValidator;

  constructor(opts: MissionOptions) {
    this.now = opts.now ?? (() => new Date().toISOString());
    this.idGen = opts.idGen ?? (() => crypto.randomUUID());
    this.id = opts.id ?? this.idGen();
    this.objective = opts.objective;
    this.scope = deepFreeze({ ...opts.scope });
    this.validate = opts.findingValidator ?? acceptAll;
    // Seed the transcript with the objective as the first immutable entry.
    this.record("objective", opts.objective);
  }

  get status(): MissionStatus {
    return this._status;
  }

  setStatus(status: MissionStatus): void {
    this._status = status;
    this.record("status", status);
  }

  /** Append an immutable transcript entry. Returns the frozen entry. */
  record(kind: TranscriptKind, content: string, meta?: Record<string, unknown>): TranscriptEntry {
    const entry: TranscriptEntry = deepFreeze({
      seq: this.seq++,
      timestamp: this.now(),
      kind,
      content,
      ...(meta ? { meta: { ...meta } } : {}),
    });
    this._transcript.push(entry);
    return entry;
  }

  /** Read-only view of the transcript (frozen entries). */
  get entries(): readonly TranscriptEntry[] {
    return this._transcript;
  }

  /** Read-only view of the findings. */
  get findings(): readonly Finding[] {
    return this._findings;
  }

  /**
   * Add a finding, subject to the finding validator. A rejected finding is
   * NEVER appended to the findings array (invariant #3, wired fully in INT 2.3).
   */
  addFinding(input: AddFindingInput): AddFindingResult {
    const finding: Finding = deepFreeze({
      id: this.idGen(),
      claim: input.claim,
      provenance: { ...input.provenance },
      status: input.status ?? "proposed",
      createdAt: this.now(),
    });
    const decision = this.validate(finding, this._transcript);
    if (!decision.accepted) return { accepted: false, reason: decision.reason };
    this._findings.push(finding);
    return { accepted: true, finding };
  }

  /**
   * Replace a finding's status/refutation by appending a NEW frozen finding and
   * removing the stale reference from the live array. The transcript entry that
   * backs the finding is untouched. Used by the refuter (INT 2.4) to promote to
   * confirmed or mark retracted without mutating the original object.
   */
  updateFindingStatus(id: string, status: FindingStatus, refutation?: string): Finding | undefined {
    const idx = this._findings.findIndex((f) => f.id === id);
    if (idx < 0) return undefined;
    const prev = this._findings[idx]!;
    const next: Finding = deepFreeze({
      ...prev,
      status,
      ...(refutation !== undefined ? { refutation } : {}),
    });
    this._findings.splice(idx, 1, next);
    this.record("note", `finding ${id} -> ${status}`, refutation ? { refutation } : undefined);
    return next;
  }

  /** Formatted transcript for feeding back to the model. */
  transcript(): string {
    return this._transcript
      .map((e) => {
        const meta = e.meta ? ` ${JSON.stringify(e.meta)}` : "";
        return `[${e.seq}] ${e.kind.toUpperCase()}: ${e.content}${meta}`;
      })
      .join("\n");
  }

  /** Serializable, frozen snapshot of the whole mission. */
  snapshot(): MissionSnapshot {
    return deepFreeze({
      id: this.id,
      objective: this.objective,
      scope: { ...this.scope },
      status: this._status,
      transcript: [...this._transcript],
      findings: [...this._findings],
    });
  }
}
