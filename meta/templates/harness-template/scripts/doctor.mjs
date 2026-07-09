#!/usr/bin/env bun
/**
 * Minimal environment healthcheck for a freshly scaffolded harness.
 * Extend with provider-key and PATH checks as you wire real transports.
 */
import { existsSync } from "node:fs";

const checks = [
  ["package.json present", existsSync("package.json")],
  ["src/agent present", existsSync("src/agent/index.ts")],
  ["harness.json manifest present", existsSync("harness.json")],
];

let failed = 0;
for (const [label, ok] of checks) {
  process.stdout.write(`${ok ? "✅" : "❌"} ${label}\n`);
  if (!ok) failed++;
}
if (failed > 0) {
  process.stdout.write(`\n${failed} check(s) failed.\n`);
  process.exit(1);
}
process.stdout.write("\nHarness environment healthy.\n");
