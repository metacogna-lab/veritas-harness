/**
 * Approval gate + risk-tier gating — invariant #2: fail-safe deny.
 *
 * PURE module: no I/O. The host process injects the approver (how to ask a
 * human), a warning sink (for loud SPICY-tier warnings), and an audit sink
 * (every decision is recorded). This module only decides.
 *
 * Tiers:
 *   - GATED_TIERS {intrusive, credential, dangerous}: inert until approved;
 *     once approved, free for the rest of the session (approve-once-then-free).
 *   - SPICY_TIERS {credential, dangerous}: emit a loud, audited, NON-blocking
 *     warning on EVERY call, even after approval.
 *
 * Two approval paths:
 *   - interactive: ask the human (approver) on first use of a gated tool.
 *   - pre-authorized: a headless/batch run supplies an allowlist up front;
 *     anything off-list is denied. Every decision is audited either way.
 *
 * FAIL-SAFE: a gated tool with no approver wired AND no pre-authorization is
 * DENIED — never silently fired.
 */
import type { RiskTier } from "../tools/registry.ts";
import type { ScopeDecision } from "./scope.ts";

export const GATED_TIERS: ReadonlySet<RiskTier> = new Set(["intrusive", "credential", "dangerous"]);
export const SPICY_TIERS: ReadonlySet<RiskTier> = new Set(["credential", "dangerous"]);

export interface ApprovalRequest {
  toolName: string;
  tier: RiskTier;
  /** Optional human-readable detail about what the call will do. */
  detail?: string;
}

export type Approver = (req: ApprovalRequest) => boolean | Promise<boolean>;
export type WarningSink = (message: string, req: ApprovalRequest) => void;

export interface AuditEntry {
  toolName: string;
  tier: RiskTier;
  decision: "allow" | "deny";
  reason: string;
}
export type AuditSink = (entry: AuditEntry) => void;

export interface ApprovalPolicy {
  /** Interactive approver (attended runs). Absent ⇒ unattended. */
  approver?: Approver;
  /** Pre-authorized tool names (headless/batch). Off-list ⇒ deny. */
  preAuthorized?: string[];
  /** Loud warning sink for SPICY tiers. */
  warn?: WarningSink;
  /** Audit sink invoked for every gated decision. */
  audit?: AuditSink;
}

/** Per-session record of approve-once-then-free grants. Host-owned, mutable. */
export class ApprovalSession {
  private readonly approved = new Set<string>();
  grant(toolName: string): void {
    this.approved.add(toolName);
  }
  isGranted(toolName: string): boolean {
    return this.approved.has(toolName);
  }
}

const DENY = (detail: string): ScopeDecision => ({ allowed: false, reason: `APPROVAL DENIED: ${detail}` });
const ALLOW: ScopeDecision = { allowed: true };

/**
 * Decide whether a tool call at a given risk tier may proceed. Scope is checked
 * separately and first (see safety/index.ts); this only handles approval.
 */
export async function requestApproval(
  req: ApprovalRequest,
  policy: ApprovalPolicy,
  session: ApprovalSession,
): Promise<ScopeDecision> {
  // Ungated tiers never require approval and never warn.
  if (!GATED_TIERS.has(req.tier)) return ALLOW;

  // SPICY warning fires on EVERY call, even when already approved.
  if (SPICY_TIERS.has(req.tier)) {
    policy.warn?.(`SPICY TOOL CALL: "${req.toolName}" (tier=${req.tier})`, req);
  }

  const audit = (decision: "allow" | "deny", reason: string): void => {
    policy.audit?.({ toolName: req.toolName, tier: req.tier, decision, reason });
  };

  // Approve-once-then-free: a prior grant this session lets it run.
  if (session.isGranted(req.toolName)) {
    audit("allow", "prior session approval");
    return ALLOW;
  }

  // Pre-authorized fast path (headless/batch).
  if (policy.preAuthorized) {
    if (policy.preAuthorized.includes(req.toolName)) {
      session.grant(req.toolName);
      audit("allow", "pre-authorized allowlist");
      return ALLOW;
    }
    // Off-list under a pre-auth policy with no interactive fallback ⇒ deny.
    if (!policy.approver) {
      audit("deny", "off pre-authorized allowlist");
      return DENY(`"${req.toolName}" not on the pre-authorized allowlist`);
    }
  }

  // Interactive path.
  if (policy.approver) {
    const ok = await policy.approver(req);
    if (ok) {
      session.grant(req.toolName);
      audit("allow", "interactive approval");
      return ALLOW;
    }
    audit("deny", "interactive denial");
    return DENY(`human declined "${req.toolName}"`);
  }

  // FAIL-SAFE: gated, unattended, no pre-authorization ⇒ deny.
  audit("deny", "fail-safe: no approver wired");
  return DENY(`gated tool "${req.toolName}" (tier=${req.tier}) has no approver wired and is not pre-authorized`);
}
