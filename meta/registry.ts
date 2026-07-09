/**
 * Harness registry — the meta-harness's record of every harness it owns.
 *
 * The registry is the single source of truth for "which harnesses exist, in what
 * order, with which capabilities". It lives at the repo root as `harnesses.json`.
 * Every function here is PURE with respect to the registry value: updates return a
 * NEW registry object (never mutate), per the immutability rule. Only `readRegistry`
 * and `writeRegistry` touch the filesystem.
 *
 * Ordering invariant (#4): each harness gets a monotonically increasing 1-based
 * `index` in creation order. `veritas-research` is index 1.
 */
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** The eight orthogonal planes every harness composes (see agents/plans/08). */
export const PLANES = [
  "provider",
  "safety",
  "verification",
  "memory",
  "capability",
  "execution",
  "orchestration",
  "control",
] as const;
export type Plane = (typeof PLANES)[number];

export const harnessEntrySchema = z.object({
  /** kebab-case directory name under harness/. */
  name: z.string().regex(/^[a-z][a-z0-9-]*$/, "harness name must be kebab-case"),
  /** 1-based creation order. */
  index: z.number().int().positive(),
  /** Path relative to repo root. */
  path: z.string(),
  /** Capability packs installed at init (e.g. "research"). */
  capabilities: z.array(z.string()).default([]),
  /** Planes the harness declares it composes. */
  planes: z.array(z.enum(PLANES)).default([...PLANES]),
  /** ISO date the harness was registered. */
  createdAt: z.string(),
  status: z.enum(["active", "archived"]).default("active"),
});
export type HarnessEntry = z.infer<typeof harnessEntrySchema>;

export const registrySchema = z.object({
  version: z.literal(1),
  harnesses: z.array(harnessEntrySchema),
});
export type Registry = z.infer<typeof registrySchema>;

export const REGISTRY_FILENAME = "harnesses.json";

export const emptyRegistry = (): Registry => ({ version: 1, harnesses: [] });

/** Read + validate the registry at `<root>/harnesses.json`. Missing file → empty. */
export function readRegistry(root: string): Registry {
  const file = join(root, REGISTRY_FILENAME);
  if (!existsSync(file)) return emptyRegistry();
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`registry at ${file} is not valid JSON: ${(err as Error).message}`);
  }
  const parsed = registrySchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`registry at ${file} failed validation: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** Serialize + write the registry (validates first). Returns the file path. */
export function writeRegistry(root: string, registry: Registry): string {
  const validated = registrySchema.parse(registry);
  const file = join(root, REGISTRY_FILENAME);
  writeFileSync(file, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  return file;
}

/** Next 1-based index = one past the current max (stable even if entries are archived). */
export function nextIndex(registry: Registry): number {
  return registry.harnesses.reduce((max, h) => Math.max(max, h.index), 0) + 1;
}

export function findByName(registry: Registry, name: string): HarnessEntry | undefined {
  return registry.harnesses.find((h) => h.name === name);
}

/**
 * Return a NEW registry with `entry` appended. Rejects duplicate names — a harness
 * name is unique across the repo (it is also a directory name under harness/).
 */
export function addHarness(registry: Registry, entry: HarnessEntry): Registry {
  if (findByName(registry, entry.name)) {
    throw new Error(`harness "${entry.name}" is already registered`);
  }
  const validated = harnessEntrySchema.parse(entry);
  return { ...registry, harnesses: [...registry.harnesses, validated] };
}
