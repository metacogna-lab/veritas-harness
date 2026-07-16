/**
 * Stdin approver for interactive /start — asks y/n for gated tools.
 */
import type { Approver, ApprovalRequest } from "@spine/safety/approval.ts";

export type AskFn = (question: string) => Promise<string>;

/**
 * Build an Approver that prompts on stdin (or an injectable ask) for yes/no.
 * Empty / unknown answers deny (fail-safe).
 */
export function createStdinApprover(ask: AskFn): Approver {
  return async (req: ApprovalRequest): Promise<boolean> => {
    const detail = req.detail ? ` — ${req.detail}` : "";
    const answer = (
      await ask(`Approve gated tool "${req.toolName}" [${req.tier}]${detail}? [y/N] `)
    )
      .trim()
      .toLowerCase();
    return answer === "y" || answer === "yes";
  };
}
