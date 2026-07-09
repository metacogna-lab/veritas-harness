#!/usr/bin/env bun
/**
 * Ingest CLI — compile NEW.md into missions/<slug>/research-plan.json.
 *
 *   bun scripts/ingest.mjs --input ingest/examples/scope-gate-study.NEW.md
 *   bun scripts/ingest.mjs --input ingest/NEW.md --slug my-study
 */
import { runIngest } from "../src/ingest.ts";

function parseArgs(argv: string[]) {
  const flags: Record<string, string> = {};
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "true";
      }
    } else {
      positionals.push(a);
    }
  }
  return { flags, positionals };
}

async function main(): Promise<number> {
  const { flags } = parseArgs(process.argv.slice(2));
  const input = flags.input;
  if (!input) {
    console.error("usage: ingest.mjs --input <NEW.md> [--slug <slug>] [--dry-run]");
    return 2;
  }

  try {
    const { plan, outputPath } = await runIngest({
      inputPath: input,
      slug: flags.slug,
      dryRun: flags["dry-run"] === "true",
    });
    if (flags["dry-run"] === "true") {
      console.log(JSON.stringify(plan, null, 2));
    } else {
      console.log(`ingest: wrote ${outputPath}`);
      console.log(`  objective: ${plan.objective}`);
      console.log(`  loadout: ${plan.loadout}`);
    }
    return 0;
  } catch (err) {
    console.error(`ingest: ${(err as Error).message}`);
    return 1;
  }
}

process.exit(await main());
