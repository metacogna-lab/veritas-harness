/**
 * Per-harness manifest (`harness/<name>/harness.json`).
 *
 * A harness's self-description: its registry identity, the planes it composes, the
 * capability packs it was built with, and the harness-specific skills it owns
 * (initialized into `harness/<name>/skills/` at creation time — invariant #3:
 * generic skills live at the meta root, harness-specific skills live in the harness).
 *
 * This is what lets the meta-harness treat every harness uniformly — including
 * `veritas-research` (#1), which is conformed by adding a manifest, NOT by
 * regenerating it.
 */
import { z } from "zod";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PLANES } from "./registry.ts";

export const MANIFEST_FILENAME = "harness.json";

export const manifestSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
  index: z.number().int().positive(),
  description: z.string().default(""),
  capabilities: z.array(z.string()).default([]),
  planes: z.array(z.enum(PLANES)).default([...PLANES]),
  /** Harness-specific skills owned by this harness (names under its skills/ dir). */
  skills: z.array(z.string()).default([]),
});
export type Manifest = z.infer<typeof manifestSchema>;

export function readManifest(harnessDir: string): Manifest {
  const file = join(harnessDir, MANIFEST_FILENAME);
  if (!existsSync(file)) throw new Error(`no ${MANIFEST_FILENAME} in ${harnessDir}`);
  const parsed = manifestSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) throw new Error(`${file} failed validation: ${parsed.error.message}`);
  return parsed.data;
}

export function writeManifest(harnessDir: string, manifest: Manifest): string {
  const validated = manifestSchema.parse(manifest);
  const file = join(harnessDir, MANIFEST_FILENAME);
  writeFileSync(file, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  return file;
}
