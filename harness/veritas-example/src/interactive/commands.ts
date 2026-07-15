/**
 * Slash-command parser and help text for the interactive shell.
 */
export interface ParsedSlash {
  name: string;
  args: string;
  tokens: string[];
}

/** True when a line should be treated as a slash command. */
export function isSlash(line: string): boolean {
  return line.trimStart().startsWith("/");
}

/** Parse `/cmd rest…` into name + args. Returns null if not a slash line. */
export function parseSlash(line: string): ParsedSlash | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("/")) return null;
  const body = trimmed.slice(1).trim();
  if (!body) return { name: "", args: "", tokens: [] };
  const space = body.search(/\s/);
  if (space < 0) return { name: body.toLowerCase(), args: "", tokens: [] };
  const name = body.slice(0, space).toLowerCase();
  const args = body.slice(space + 1).trim();
  const tokens = args.length === 0 ? [] : args.split(/\s+/);
  return { name, args, tokens };
}

export const COMMAND_HELP: ReadonlyArray<{ name: string; usage: string; blurb: string }> = [
  { name: "help", usage: "/help", blurb: "List commands and planning tips" },
  { name: "ingest", usage: "/ingest [path]", blurb: "Compile a brief file, or interview for slug/objective" },
  { name: "sources", usage: "/sources <path>", blurb: "Stage .md/.pdf/.txt from a directory into the draft" },
  { name: "plan", usage: "/plan [--json]", blurb: "Show current draft summary (or raw JSON)" },
  { name: "eval", usage: "/eval", blurb: "Run dogma gate on the draft" },
  { name: "write", usage: "/write", blurb: "Persist draft if required dogma passes" },
  { name: "digest", usage: "/digest", blurb: "Digest sources for the written plan" },
  { name: "start", usage: "/start", blurb: "Start a mission from the written plan" },
  { name: "status", usage: "/status [id]", blurb: "Mission status (defaults to last /start id)" },
  { name: "report", usage: "/report [id]", blurb: "Mission report (defaults to last /start id)" },
  { name: "loadouts", usage: "/loadouts", blurb: "List registered loadouts" },
  { name: "clear", usage: "/clear", blurb: "Reset draft session state" },
  { name: "quit", usage: "/quit | /exit", blurb: "Leave the interactive shell" },
];

/** Render /help text for the operator. */
export function renderHelp(): string {
  const rows = COMMAND_HELP.map((c) => `  ${c.usage.padEnd(28)} ${c.blurb}`);
  return [
    "Interactive Veritas — natural language drafts a plan; slash commands structure it.",
    "",
    "Commands:",
    ...rows,
    "",
    "Tips:",
    "  • Describe an objective in plain text to draft or refine the research plan.",
    "  • /eval before /write — /write is blocked until required dogma dimensions pass.",
    "  • Headless one-shot verbs (start/eval/ingest …) still work outside this shell.",
  ].join("\n");
}

export const KNOWN_COMMANDS = new Set([...COMMAND_HELP.map((c) => c.name), "exit"]);
