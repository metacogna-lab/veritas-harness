/**
 * Memory plane — ephemeral windowed context.
 *
 * The durable side of the Memory plane is the Mission ledger (append-only, never
 * summarized, the source of truth for provenance). This is the OTHER side: the
 * bounded, lossy view actually sent to the model each turn. It keeps recent turns
 * verbatim, rolls older turns into a running summary, and carries a scratchpad —
 * all under a HARD token ceiling so the execution plane can never blow the context
 * window. Nothing here is authoritative; findings must always cite the ledger, not
 * this window (invariant #3).
 */

export interface ContextWindowOptions {
  /** Hard upper bound on tokens the rendered window may occupy. */
  maxTokens: number;
  /** Token estimator. Default: ~4 chars/token. */
  estimateTokens?: (text: string) => number;
}

const defaultEstimate = (text: string): number => Math.ceil(text.length / 4);

export class ContextWindow {
  private readonly maxTokens: number;
  private readonly estimate: (text: string) => number;
  private _summary = "";
  private _scratchpad = "";
  private readonly _recent: string[] = [];

  constructor(opts: ContextWindowOptions) {
    if (opts.maxTokens <= 0) throw new Error("maxTokens must be positive");
    this.maxTokens = opts.maxTokens;
    this.estimate = opts.estimateTokens ?? defaultEstimate;
  }

  /** Add a turn verbatim, then evict oldest turns into the summary until under ceiling. */
  append(turn: string): void {
    this._recent.push(turn);
    this.evictUntilUnderCeiling();
  }

  setScratchpad(text: string): void {
    this._scratchpad = text;
    this.evictUntilUnderCeiling();
  }

  get scratchpad(): string {
    return this._scratchpad;
  }

  get summary(): string {
    return this._summary;
  }

  get recent(): readonly string[] {
    return [...this._recent];
  }

  /** Estimated token cost of the current rendered (hard-bounded) window. */
  tokens(): number {
    return this.estimate(this.render());
  }

  /**
   * The bounded text to send to the model this turn: summary, then recent turns,
   * then scratchpad. GUARANTEED to estimate at or under `maxTokens` — normal
   * pressure is relieved by rolling old turns into the summary (see append), and a
   * single item larger than the whole ceiling is hard-clipped to its tail as a last
   * resort so the execution plane can never overflow the context window.
   */
  render(): string {
    const raw = this.rawRender();
    if (this.estimate(raw) <= this.maxTokens) return raw;
    // Last resort: keep the most recent characters that fit the ceiling.
    return raw.slice(raw.length - this.maxTokens * 4);
  }

  /** The full, un-clipped window — used to decide eviction, never sent verbatim. */
  private rawRender(): string {
    const parts: string[] = [];
    if (this._summary) parts.push(`[summary]\n${this._summary}`);
    for (const turn of this._recent) parts.push(turn);
    if (this._scratchpad) parts.push(`[scratchpad]\n${this._scratchpad}`);
    return parts.join("\n");
  }

  /** Move the oldest recent turn into the summary until the window fits (keeps ≥1 recent turn). */
  private evictUntilUnderCeiling(): void {
    while (this.estimate(this.rawRender()) > this.maxTokens && this._recent.length > 1) {
      const evicted = this._recent.shift()!;
      this._summary = this._summary ? `${this._summary}\n- ${compact(evicted)}` : `- ${compact(evicted)}`;
    }
  }
}

/** Compress a turn into a one-line summary fragment. */
function compact(turn: string): string {
  const oneLine = turn.replace(/\s+/g, " ").trim();
  return oneLine.length > 200 ? `${oneLine.slice(0, 197)}…` : oneLine;
}
