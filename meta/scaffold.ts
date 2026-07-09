/**
 * Filesystem helpers for the create-harness pipeline. Isolated from the pipeline
 * so they can be unit-tested and reused. No process/exit concerns here.
 */
import { readdirSync, mkdirSync, readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Recursively copy `src` → `dest`, replacing each token key with its value in every text file. */
export function copyDirWithTokens(src: string, dest: string, tokens: Record<string, string>): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const from = join(src, entry);
    const to = join(dest, entry);
    if (statSync(from).isDirectory()) {
      copyDirWithTokens(from, to, tokens);
    } else {
      let contents = readFileSync(from, "utf8");
      for (const [token, value] of Object.entries(tokens)) {
        contents = contents.split(token).join(value);
      }
      writeFileSync(to, contents);
    }
  }
}

export const isKebabCase = (name: string): boolean => /^[a-z][a-z0-9-]*$/.test(name);

/** List the capability packs available under `skillsRoot` (each subdir is a pack). */
export function availablePacks(skillsRoot: string): string[] {
  if (!existsSync(skillsRoot)) return [];
  return readdirSync(skillsRoot).filter((e) => statSync(join(skillsRoot, e)).isDirectory());
}

/** Skill names shipped by a capability pack (each subdir under the pack is one skill). */
export function packSkillNames(packDir: string): string[] {
  if (!existsSync(packDir)) return [];
  return readdirSync(packDir).filter((e) => statSync(join(packDir, e)).isDirectory());
}
