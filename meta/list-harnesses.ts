/**
 * `bun run list-harnesses` — print the harness registry as a table.
 * Read-only; the meta-harness's inventory view.
 */
import { readRegistry } from "./registry.ts";

function main(): void {
  const root = process.cwd();
  const registry = readRegistry(root);
  if (registry.harnesses.length === 0) {
    process.stdout.write("No harnesses registered. Create one: bun run create-harness <name>\n");
    return;
  }
  const rows = [...registry.harnesses].sort((a, b) => a.index - b.index);
  process.stdout.write(`Harnesses (${rows.length}):\n\n`);
  for (const h of rows) {
    const caps = h.capabilities.length ? h.capabilities.join(", ") : "—";
    process.stdout.write(`  #${h.index}  ${h.name.padEnd(24)} [${h.status}]  ${h.path}\n`);
    process.stdout.write(`        capabilities: ${caps}\n`);
  }
}

if (import.meta.main) main();
