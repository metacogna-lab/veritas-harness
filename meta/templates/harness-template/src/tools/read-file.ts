/**
 * Starter tool: read a UTF-8 text file. Read-only, but it does real I/O, so it is
 * tiered `active` and declares an `fs-read` scope target — the gate decides.
 */
import { z } from "zod";
import { readFileSync } from "node:fs";
import type { Tool } from "./registry.ts";

const inputSchema = z.object({ path: z.string().min(1) });

export const readFile: Tool<z.infer<typeof inputSchema>> = {
  name: "read_file",
  description: "Read a UTF-8 text file within mission scope. Returns up to 20k characters.",
  inputSchema,
  riskTier: "active",
  scopeTargets: (input) => [{ kind: "fs-read", value: input.path }],
  run: async (input) => {
    try {
      return readFileSync(input.path, "utf8").slice(0, 20_000);
    } catch (err) {
      return `READ ERROR: ${(err as Error).message}`;
    }
  },
};
