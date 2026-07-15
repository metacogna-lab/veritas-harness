/**
 * Control plane (minimal) — the mission front door for this harness.
 *
 * The template ships a `planes` command (print the plane map), a `smoke`
 * command (run the spine end-to-end against the scripted backbone, no network),
 * and `loadouts` (list LoadoutRegistry entries — populated by --from-spec codegen).
 */
import { PLANES } from "./planes.ts";
import { ToolRegistry } from "./tools/registry.ts";
import { readFile } from "./tools/read-file.ts";
import { Mission } from "./mission/index.ts";
import { runAgent, scopeOnlyCheck } from "./agent/index.ts";
import { ScriptedBackbone } from "./llm/echo.ts";
import { defaultLoadouts } from "./agent/loadouts.ts";

function printPlanes(): void {
  process.stdout.write("Eight planes:\n\n");
  for (const [name, p] of Object.entries(PLANES)) {
    process.stdout.write(`  ${name.padEnd(14)} ${p.module.padEnd(26)} ${p.role}\n`);
  }
}

function printLoadouts(): void {
  const all = defaultLoadouts().list();
  if (all.length === 0) {
    process.stdout.write("(no loadouts — use create-harness --from-spec, or edit src/agent/loadouts.generated.ts)\n");
    return;
  }
  for (const l of all) {
    process.stdout.write(`${l.name}: ${l.description}\n`);
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
  if (verb === "loadouts") return printLoadouts();
  process.stdout.write(`unknown verb "${verb}". try: planes | smoke | loadouts\n`);
}

if (import.meta.main) await main();
