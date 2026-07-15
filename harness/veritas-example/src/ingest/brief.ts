/**
 * Synthetic NEW.md brief builder (Feature 1). Produces the same frontmatter+section
 * shape the headless CLI feeds to runIngest, so the API `/v1/ingest` path compiles
 * intents through the identical pipeline (no forked ingest).
 */
export interface BriefInput {
  slug: string;
  objective: string;
  target?: string;
  sources?: string[];
}

/** Build a synthetic NEW.md string for `runIngest({ syntheticContent })`. */
export function buildSyntheticBrief(input: BriefInput): string {
  const targetLine = input.target ? `target_hint: "${input.target}"` : "";
  const sourcesBlock =
    input.sources && input.sources.length > 0
      ? `sources:\n${input.sources.map((s) => `  - "${s}"`).join("\n")}`
      : "";
  return [
    "---",
    `title: "${input.objective}"`,
    `slug: "${input.slug}"`,
    ...(targetLine ? [targetLine] : []),
    ...(sourcesBlock ? [sourcesBlock] : []),
    "---",
    "",
    "## research question",
    "",
    input.objective,
  ].join("\n");
}
