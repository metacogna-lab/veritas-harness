/**
 * read_file — read a UTF-8 file's contents.
 *
 * riskTier `active`: real side effect (filesystem read / information
 * disclosure), so it is scope-gated even though it is read-only. This is
 * conservative per the tool-adder rule "anything with side effects is at least
 * active"; the plan's "safe-tier starter tool" wording is looser. Gating
 * behavior is identical (neither safe nor active is in GATED_TIERS).
 */
import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { Tool } from "./registry.ts";

const inputSchema = z.object({
  path: z.string().describe("Absolute path of the file to read (must be within mission scope)."),
});
type Input = z.infer<typeof inputSchema>;

const MAX_BYTES = 200_000;

export const readFileTool: Tool<Input> = {
  name: "read_file",
  description: "Read the UTF-8 contents of a file at an absolute path inside the mission scope.",
  inputSchema,
  riskTier: "active",
  scopeTargets: (input) => [{ kind: "fs-read", value: input.path }],
  run: async (input) => {
    const content = await readFile(input.path, "utf8");
    if (content.length > MAX_BYTES) {
      return `${content.slice(0, MAX_BYTES)}\n...[truncated at ${MAX_BYTES} chars]`;
    }
    return content;
  },
};
