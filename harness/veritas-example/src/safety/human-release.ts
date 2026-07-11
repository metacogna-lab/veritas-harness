/**
 * Human-gated terminal actions — invariant #5: human before consequence.
 *
 * Consequential terminal actions (send, publish, delete, deploy, disclose) stop
 * one step short: the harness produces a draft/plan observation and does NOT
 * execute until a human explicitly releases. Pure module — host injects releaser.
 *
 * FAIL-SAFE: a terminal tool with no releaser wired is DENIED — never auto-fired,
 * even in headless/unattended runs with pre-authorized approval tiers.
 */
import type { ScopeDecision } from "./scope.ts";

export type TerminalActionKind = "send" | "publish" | "delete" | "deploy" | "disclose" | "other";

export interface TerminalAction {
  toolName: string;
  kind: TerminalActionKind;
  /** Human-readable summary of what would happen if released. */
  summary: string;
  /** Optional structured draft the human reviews before release. */
  draft?: Record<string, unknown>;
}

export type HumanReleaser = (action: TerminalAction) => boolean | Promise<boolean>;

export interface HumanReleaseAuditEntry {
  toolName: string;
  kind: TerminalActionKind;
  decision: "release" | "deny";
  reason: string;
}
export type HumanReleaseAuditSink = (entry: HumanReleaseAuditEntry) => void;

export interface HumanReleasePolicy {
  /** Explicit human release callback. Absent ⇒ fail-safe deny for terminal tools. */
  releaser?: HumanReleaser;
  /** Pre-released action keys for headless runs: `${toolName}:${kind}`. */
  preReleased?: string[];
  audit?: HumanReleaseAuditSink;
}

/** Per-session grants after an interactive release (release-once-then-free). */
export class HumanReleaseSession {
  private readonly released = new Set<string>();

  grant(toolName: string, kind: TerminalActionKind): void {
    this.released.add(`${toolName}:${kind}`);
  }

  isReleased(toolName: string, kind: TerminalActionKind): boolean {
    return this.released.has(`${toolName}:${kind}`);
  }
}

const DENY = (detail: string): ScopeDecision => ({ allowed: false, reason: `HUMAN RELEASE REQUIRED: ${detail}` });
const ALLOW: ScopeDecision = { allowed: true };

/**
 * Gate a terminal action. Returns allow only when a human (or pre-release list)
 * explicitly permits execution.
 */
export async function requireHumanRelease(
  action: TerminalAction,
  policy: HumanReleasePolicy,
  session: HumanReleaseSession,
): Promise<ScopeDecision> {
  const key = `${action.toolName}:${action.kind}`;
  const audit = (decision: "release" | "deny", reason: string): void => {
    policy.audit?.({ toolName: action.toolName, kind: action.kind, decision, reason });
  };

  if (session.isReleased(action.toolName, action.kind)) {
    audit("release", "prior session release");
    return ALLOW;
  }

  if (policy.preReleased?.includes(key)) {
    session.grant(action.toolName, action.kind);
    audit("release", "pre-released allowlist");
    return ALLOW;
  }

  if (policy.releaser) {
    const ok = await policy.releaser(action);
    if (ok) {
      session.grant(action.toolName, action.kind);
      audit("release", "interactive human release");
      return ALLOW;
    }
    audit("deny", "human declined release");
    return DENY(`human declined release for "${action.toolName}" (${action.kind})`);
  }

  audit("deny", "fail-safe: no releaser wired");
  return DENY(
    `terminal action "${action.toolName}" (${action.kind}) requires explicit human release — harness stops one step short`,
  );
}
