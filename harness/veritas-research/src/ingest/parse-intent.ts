/**
 * Parse research intent from NEW.md — YAML frontmatter plus ## section bodies.
 */
import { load as yamlLoad } from "js-yaml";
import { sanitizeIngestText } from "./sanitize.ts";

export interface ParsedIntentFrontmatter {
  title: string;
  slug: string;
  author?: string;
  created?: string;
  loadout_hint?: string;
  target_hint?: string;
  priority?: string;
  sources?: string[];
}

export interface ParsedIntent {
  frontmatter: ParsedIntentFrontmatter;
  sections: Record<string, string>;
  rawPath?: string;
}

const SECTION_RE = /^##\s+(.+)$/m;

/** Split YAML frontmatter from markdown body. */
export function splitFrontmatter(text: string): { yaml: string; body: string } | undefined {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return undefined;
  return { yaml: match[1]!, body: match[2]! };
}

/** Parse YAML frontmatter into a flat record. */
export function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const parsed = yamlLoad(yaml);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
  return parsed as Record<string, unknown>;
}

/** Extract ## heading sections into a map keyed by lowercased heading name. */
export function parseSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const parts = body.split(SECTION_RE);
  if (parts.length <= 1) return sections;

  for (let i = 1; i < parts.length; i += 2) {
    const heading = parts[i]!.trim().toLowerCase().replace(/\s+/g, " ");
    const content = (parts[i + 1] ?? "").trim();
    sections[heading] = content;
  }
  return sections;
}

/** Parse a NEW.md file into structured intent after sanitization. */
export function parseIntentFile(content: string, rawPath?: string): ParsedIntent {
  const { text, blocked, pattern } = sanitizeIngestText(content);
  if (blocked) throw new Error(`INGEST BLOCKED: prompt injection detected (${pattern})`);

  const split = splitFrontmatter(text);
  if (!split) throw new Error("NEW.md must begin with YAML frontmatter (---)");

  const yaml = parseSimpleYaml(split.yaml);
  const title = String(yaml.title ?? "");
  const slug = String(yaml.slug ?? "");
  if (!title || !slug) throw new Error("NEW.md frontmatter requires title and slug");

  const sources = Array.isArray(yaml.sources)
    ? yaml.sources.map(String)
    : yaml.sources
      ? [String(yaml.sources)]
      : undefined;

  return {
    frontmatter: {
      title,
      slug,
      author: yaml.author ? String(yaml.author) : undefined,
      created: yaml.created ? String(yaml.created) : undefined,
      loadout_hint: yaml.loadout_hint ? String(yaml.loadout_hint) : undefined,
      target_hint: yaml.target_hint ? String(yaml.target_hint) : undefined,
      priority: yaml.priority ? String(yaml.priority) : undefined,
      sources,
    },
    sections: parseSections(split.body),
    rawPath,
  };
}
