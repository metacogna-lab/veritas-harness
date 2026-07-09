/**
 * Control plane (minimal) — the mission front door for this harness.
 *
 * The template ships a `planes` command (print the plane map) and a `smoke`
 * command (run the spine end-to-end against the scripted backbone, no network).
 * Extend here with real verbs: start "<objective>" --scope ..., status, report.
 */
import { PLANES } from "./planes.ts";
import { ToolRegistry } from "./tools/registry.ts";
import { readFile } from "./tools/read-file.ts";
import { Mission } from "./mission/index.ts";
import { runAgent, scopeOnlyCheck } from "./agent/index.ts";
import { ScriptedBackbone } from "./llm/echo.ts";

function printPlanes(): void {
  process.stdout.write("Eight planes:\n\n");
  for (const [name, p] of Object.entries(PLANES)) {
    process.stdout.write(`  ${name.padEnd(14)} ${p.module.padEnd(26)} ${p.role}\n`);
  }
}

async function smoke(): Promise<void> {
  const mission = new Mission("Summarize the harness README", { hosts: [], paths: [process.cwd()] });
  const registry = new ToolRegistry().register(readFile);
  const llm = new ScriptedBackbone([
    { text: "reading the readme", toolCalls: [{ name: "read_file", input: { path: `${process.cwd()}/README.md` } }] },
    { text: '{"action":"final","answer":"done"}', toolCalls: [] },
  ]);
  const result = await runAgent({ llm, registry, mission, system: "You are a harness.", safetyCheck: scopeOnlyCheck(mission.scope) });
  process.stdout.write(`smoke: ${result.answer} (steps=${result.steps}, observations=${mission.log.length})\n`);
}

async function main(): Promise<void> {
  const verb = process.argv[2] ?? "planes";
  if (verb === "planes") return printPlanes();
  if (verb === "smoke") return smoke();
  process.stdout.write(`unknown verb "${verb}". try: planes | smoke\n`);
}

if (import.meta.main) await main();
