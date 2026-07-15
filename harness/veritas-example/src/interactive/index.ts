/**
 * Interactive mode entry — Claude Code–style planning + ingest shell.
 */
import type { LLMBackbone } from "../llm/index.ts";
import { runShell, type ShellDeps } from "./shell.ts";

export type { ShellDeps };
export { runShell } from "./shell.ts";
export { createSession, clearSession, summarizeDraft } from "./session.ts";
export { parseSlash, isSlash, renderHelp, KNOWN_COMMANDS } from "./commands.ts";
export { planTurn, buildPlannerUserContent } from "./planner.ts";
export { createStdinApprover } from "./approver.ts";

export interface InteractiveDeps {
  print?: (line: string) => void;
  printErr?: (line: string) => void;
  buildLLM: () => LLMBackbone;
  runsDir?: string;
  harnessRoot?: string;
  banner?: boolean;
  ask?: ShellDeps["ask"];
  askApproval?: ShellDeps["askApproval"];
}

/** Start the interactive planning/ingest shell. Testable; never calls process.exit. */
export async function runInteractive(deps: InteractiveDeps): Promise<number> {
  return runShell(deps);
}
