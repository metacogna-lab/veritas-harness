/**
 * HarnessSpec — the missing bridge between an ingested intention and a generated
 * harness (veritas-v0.2 H-4). Ingest today produces a ResearchPlan for the *existing*
 * example harness; it never says "build a harness shaped like this". HarnessSpec is
 * that contract: `deriveHarnessSpec` maps intent → spec, and `create-harness --from-spec`
 * consumes it. The 7-stage pipeline is reused unchanged; only scaffold gains a variant.
 *
 * Kept in meta/ (the harness-creation owner) and decoupled from core's ResearchPlan by
 * taking a structural `IngestedIntent` subset — so meta never imports the mission schema.
 */
import { z } from "zod";

export const harnessSpecSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/, "harness name must be kebab-case"),
  capabilities: z.array(z.string()).default([]),
  loadouts: z
    .array(
      z.object({
        name: z.string().min(1),
        specialists: z
          .array(z.object({ role: z.string().min(1), focus: z.string().min(1) }))
          .min(1, "a loadout needs at least one specialist"),
        toolNames: z.array(z.string().min(1)).min(1, "a loadout needs at least one tool"),
        adapter: z.enum(["path", "host"]).default("path"),
      }),
    )
    .min(1, "a spec needs at least one loadout"),
  tools: z.array(z.object({ name: z.string().min(1), riskTier: z.string().default("safe") })).default([]),
  scopeDefaults: z
    .object({ hosts: z.array(z.string()).default([]), paths: z.array(z.string()).default([]) })
    .default({ hosts: [], paths: [] }),
});

export type HarnessSpec = z.infer<typeof harnessSpecSchema>;

/** Validate an untrusted object into a HarnessSpec (throws on failure). */
export function validateHarnessSpec(input: unknown): HarnessSpec {
  const parsed = harnessSpecSchema.safeParse(input);
  if (!parsed.success) throw new Error(`invalid harness spec: ${parsed.error.message}`);
  return parsed.data;
}

/** The structural subset of an ingested plan needed to derive a harness shape. */
export interface IngestedIntent {
  slug: string;
  loadout: string;
  specialists: { role: string; focus: string }[];
  scope: { hosts: string[]; paths: string[] };
  /** Tools the domain needs; defaults to the read-only research set. */
  toolNames?: string[];
  capabilities?: string[];
}

/**
 * Derive a HarnessSpec from an ingested intent (the intent→harness bridge, H-4).
 * Web targets → host adapter; filesystem targets → path adapter. Defaults to the
 * read-only research toolset so a generated harness is safe by construction.
 */
export function deriveHarnessSpec(intent: IngestedIntent): HarnessSpec {
  const adapter = intent.scope.hosts.length > 0 ? "host" : "path";
  const specialists =
    intent.specialists.length > 0
      ? intent.specialists
      : [{ role: "researcher", focus: "primary exploration of the target" }];
  return validateHarnessSpec({
    name: intent.slug,
    capabilities: intent.capabilities ?? ["research"],
    loadouts: [
      {
        name: intent.loadout || "research",
        specialists,
        toolNames: intent.toolNames ?? ["read_file", "list_dir", "record_finding"],
        adapter,
      },
    ],
    tools: [],
    scopeDefaults: intent.scope,
  });
}

/**
 * Render a `src/agent/loadouts.ts` source module from a spec (pure + deterministic).
 * This is what the scaffold's spec-driven variant writes; kept pure so it is unit-
 * testable without touching the filesystem.
 */
export function renderLoadoutsModule(spec: HarnessSpec): string {
  const loadoutEntries = spec.loadouts
    .map((l) => {
      const specialists = l.specialists
        .map((s) => `      { role: ${JSON.stringify(s.role)}, focus: ${JSON.stringify(s.focus)} }`)
        .join(",\n");
      const tools = l.toolNames.map((t) => JSON.stringify(t)).join(", ");
      return [
        `  {`,
        `    name: ${JSON.stringify(l.name)},`,
        `    adapter: ${JSON.stringify(l.adapter)},`,
        `    toolNames: [${tools}],`,
        `    specialists: [`,
        specialists,
        `    ],`,
        `  }`,
      ].join("\n");
    })
    .join(",\n");

  return [
    `// GENERATED from HarnessSpec "${spec.name}" (veritas-v0.2 H-4). Edit the spec, not this file.`,
    `// Consumed by src/agent/loadouts.ts → fromGeneratedLoadout → LoadoutRegistry.`,
    ``,
    `export const generatedLoadouts = [`,
    loadoutEntries,
    `] as const;`,
    ``,
    `export const scopeDefaults = ${JSON.stringify(spec.scopeDefaults)} as const;`,
    ``,
  ].join("\n");
}
