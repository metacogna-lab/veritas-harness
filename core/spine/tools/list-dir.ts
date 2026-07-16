/**
 * list_dir — list the entries of a directory.
 *
 * riskTier `active`: read-only filesystem access, scope-gated.
 */
import { readdir } from "node:fs/promises";
import { z } from "zod";
import type { Tool } from "./registry.ts";

const inputSchema = z.object({
  path: z.string().describe("Absolute directory path inside the mission scope."),
});
type Input = z.infer<typeof inputSchema>;

export const listDirTool: Tool<Input> = {
  name: "list_dir",
  description: "List the names of entries in a directory at an absolute path inside the mission scope.",
  inputSchema,
  riskTier: "active",
  scopeTargets: (input) => [{ kind: "fs-read", value: input.path }],
  run: async (input) => {
    const entries = await readdir(input.path, { withFileTypes: true });
    if (entries.length === 0) return "(empty directory)";
    return entries
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
      .sort()
      .join("\n");
  },
};
