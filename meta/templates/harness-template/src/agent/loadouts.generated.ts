/**
 * Spec-driven loadout rows (H-4). Empty by default; create-harness --from-spec
 * overwrites this file with rendered entries from HarnessSpec.
 */
export const generatedLoadouts: Array<{
  name: string;
  adapter: "path" | "host";
  toolNames: string[];
  specialists: { role: string; focus: string }[];
}> = [];

export const scopeDefaults = { hosts: [] as string[], paths: [] as string[] };
