import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Resolve a module that may live locally (an unmigrated harness still
 * carrying its own copy) or in the shared core/spine/ package (a migrated
 * harness). `relPath` is relative to src/, e.g. "config/index.ts".
 */
export function resolveSpineOrLocal(root, relPath) {
  const local = join(root, "src", relPath);
  if (existsSync(local)) return local;
  return join(root, "../../core/spine", relPath);
}
