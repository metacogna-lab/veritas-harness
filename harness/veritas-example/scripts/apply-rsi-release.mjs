#!/usr/bin/env bun
/**
 * Print human-executable git steps to apply an RSI review packet.
 * Does NOT modify the working tree.
 *
 * Usage: bun scripts/apply-rsi-release.mjs loadout-candidate/<proposal-id>
 */
import { existsSync } from "node:fs";
import { join, basename } from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: bun scripts/apply-rsi-release.mjs loadout-candidate/<proposal-id>");
  process.exit(2);
}
const reasoning = join(dir, "reasoning.md");
if (!existsSync(reasoning)) {
  console.error(`missing ${reasoning}`);
  process.exit(1);
}
const id = basename(dir);
console.log(`# Human apply checklist for RSI candidate ${id}`);
console.log(`# Review: ${reasoning}`);
console.log("");
console.log("git checkout -b rsi/" + id);
console.log("# Manually apply the unified diff from reasoning.md / proposed-loadout.ts");
console.log("bun test");
console.log("bun run verify-harness-candidate --candidate <your-candidate.json> --suite scope-gate");
console.log('git add -A && git commit -m "rsi: apply reviewed candidate ' + id + '"');
console.log("# Only after human review — never automated.");
