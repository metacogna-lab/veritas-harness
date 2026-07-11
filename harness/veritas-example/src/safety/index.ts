/**
 * Composed safety gate — the single entry point the agent loop uses.
 *
 *   check() = checkScope() (invariant #1)  THEN  requestApproval() (invariant #2)
 *
 * Scope is ALWAYS checked first and unconditionally: an off-scope call is
 * denied before a human is ever asked to approve it. Only if scope passes do we
 * consult the approval gate for gated risk tiers.
 *
 * `createSafetyCheck()` returns a `SafetyCheck` closure compatible with
 * `ToolRegistry.execute()` and `Agent`, so wiring the full gate into the loop is
 * a one-line swap of the BASIC scope-only default — no loop change (invariant #8).
 */
import { checkScope, type MissionScope, type ScopeDecision } from "./scope.ts";
import {
  requestApproval,
  ApprovalSession,
  type ApprovalPolicy,
} from "./approval.ts";
import {
  requireHumanRelease,
  HumanReleaseSession,
  type HumanReleasePolicy,
  type TerminalActionKind,
} from "./human-release.ts";
import type { SafetyCheck } from "../tools/registry.ts";

export * from "./scope.ts";
export * from "./approval.ts";
export * from "./human-release.ts";

export interface SafetyOptions {
  scope: MissionScope;
  policy?: ApprovalPolicy;
  session?: ApprovalSession;
  humanRelease?: HumanReleasePolicy;
  humanReleaseSession?: HumanReleaseSession;
}

/**
 * Build the composed SafetyCheck. Scope → approval → human release (terminal only).
 * With no policy/session supplied, gated tiers hit the fail-safe deny (invariant #2).
 * Terminal tools without a releaser hit fail-safe deny (invariant #5).
 */
export function createSafetyCheck(opts: SafetyOptions): SafetyCheck {
  const policy: ApprovalPolicy = opts.policy ?? {};
  const session = opts.session ?? new ApprovalSession();
  const humanPolicy: HumanReleasePolicy = opts.humanRelease ?? {};
  const humanSession = opts.humanReleaseSession ?? new HumanReleaseSession();

  return async (call, tool): Promise<ScopeDecision> => {
    const scoped = checkScope(call, opts.scope);
    if (!scoped.allowed) return scoped;

    const approved = await requestApproval({ toolName: tool.name, tier: tool.riskTier }, policy, session);
    if (!approved.allowed) return approved;

    if (!tool.requiresHumanRelease) return ALLOW;

    const kind: TerminalActionKind = tool.terminalActionKind ?? "other";
    return requireHumanRelease(
      {
        toolName: tool.name,
        kind,
        summary: `Terminal action "${tool.name}" (${kind}) awaiting human release`,
        draft: { targets: call.targets },
      },
      humanPolicy,
      humanSession,
    );
  };
}

const ALLOW: ScopeDecision = { allowed: true };
