/**
 * VERITAS ASCII banner — prints to stdout only when running in a TTY.
 * Suppressed automatically in JSON/headless/piped mode and when NO_COLOR is set.
 */

const R = "\x1b[0m";   // reset
const B = "\x1b[1m";   // bold
const D = "\x1b[2m";   // dim

// Blue → cyan gradient, one colour per row
const GRAD = [
  "\x1b[38;5;21m",
  "\x1b[38;5;27m",
  "\x1b[38;5;33m",
  "\x1b[38;5;39m",
  "\x1b[38;5;45m",
  "\x1b[38;5;51m",
];

const ART = [
  "  ██╗   ██╗███████╗██████╗ ██╗████████╗ █████╗ ███████╗",
  "  ██║   ██║██╔════╝██╔══██╗██║╚══██╔══╝██╔══██╗██╔════╝",
  "  ██║   ██║█████╗  ██████╔╝██║   ██║   ███████║███████╗",
  "  ╚██╗ ██╔╝██╔══╝  ██╔══██╗██║   ██║   ██╔══██║╚════██║",
  "   ╚████╔╝ ███████╗██║  ██║██║   ██║   ██║  ██║███████║",
  "    ╚═══╝  ╚══════╝╚═╝  ╚═╝╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝",
];

const TAGLINE = "  r e s e a r c h  ·  v e r i f y  ·  r e f u t e  ·  c o n f i r m";
const RULE    = "  " + "─".repeat(55);
const META    = "  Agent research harness  ·  BASIC → INT → ADV  ·  v0.1.0";

export interface BannerOptions {
  /** Skip TTY check and always print (useful for tests/demos). */
  force?: boolean;
}

/**
 * Print the VERITAS banner.
 * No-ops when stdout is not a TTY (unless `force` is set).
 */
export function printBanner(opts: BannerOptions = {}): void {
  const isTTY = process.stdout.isTTY === true;
  if (!isTTY && !opts.force) return;

  const color = isTTY && !process.env["NO_COLOR"];
  const w = (s: string) => process.stdout.write(s);

  w("\n");
  for (let i = 0; i < ART.length; i++) {
    if (color) w((GRAD[i] ?? "") + B);
    w(ART[i]!);
    if (color) w(R);
    w("\n");
  }
  w("\n");
  if (color) w("\x1b[38;5;87m");
  w(TAGLINE + "\n");
  if (color) w(R + "\x1b[38;5;238m");
  w(RULE + "\n");
  if (color) w(R + D);
  w(META + "\n");
  if (color) w(R);
  w("\n");
}

/**
 * Print the interactive prompt prefix shown before user input.
 * Gives the harness a distinct identity at the cursor.
 */
export function printPromptPrefix(): void {
  const isTTY = process.stdout.isTTY === true;
  const color = isTTY && !process.env["NO_COLOR"];
  if (color) process.stdout.write("\x1b[38;5;51m▸ veritas\x1b[0m  ");
  else process.stdout.write("▸ veritas  ");
}
