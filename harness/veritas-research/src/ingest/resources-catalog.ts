/**
 * Catalog harness resources available during ingest (lessons store, resource modules).
 */
import { existsSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LessonsStore } from "../resources/lessons.ts";

export interface CatalogSource {
  kind: "lesson" | "doc" | "resource" | "download";
  path: string;
  exists: boolean;
  summary?: string;
}

export interface ResourcesCatalog {
  repoRoot: string;
  harnessRoot: string;
  resourceModules: string[];
  lessonsPath: string;
  sources: CatalogSource[];
  relevantLessonIds: string[];
}

const RESOURCE_MODULE_NAMES = ["lessons.ts", "research-plan.ts"];

const INGEST_DIR = dirname(fileURLToPath(import.meta.url));

/** Resolve veritas repo root (parent of harness/). */
export function defaultRepoRoot(): string {
  return resolve(INGEST_DIR, "../../../..");
}

/** Resolve harness package root from src/ingest. */
export function defaultHarnessRoot(): string {
  return resolve(INGEST_DIR, "../..");
}

/** Build a catalog of harness resources and optional NEW.md source paths. */
export function buildResourcesCatalog(opts: {
  repoRoot?: string;
  harnessRoot?: string;
  objective: string;
  extraSources?: string[];
}): ResourcesCatalog {
  const harnessRoot = opts.harnessRoot ?? defaultHarnessRoot();
  const repoRoot = opts.repoRoot ?? defaultRepoRoot();
  const resourcesDir = join(harnessRoot, "src/resources");
  const lessonsPath = join(harnessRoot, "resources/lessons.json");

  const resourceModules = existsSync(resourcesDir)
    ? readdirSync(resourcesDir).filter((f) => RESOURCE_MODULE_NAMES.includes(f) || f.endsWith(".ts"))
    : [];

  const sources: CatalogSource[] = [];

  sources.push({
    kind: "lesson",
    path: "resources/lessons.json",
    exists: existsSync(lessonsPath),
    summary: "Committed lessons store from completed missions",
  });

  for (const mod of resourceModules) {
    sources.push({
      kind: "resource",
      path: `src/resources/${mod}`,
      exists: true,
      summary: `Harness resource module: ${mod}`,
    });
  }

  for (const rel of opts.extraSources ?? []) {
    const abs = resolve(repoRoot, rel);
    sources.push({
      kind: rel.includes("downloads") ? "download" : "doc",
      path: rel,
      exists: existsSync(abs),
    });
  }

  let relevantLessonIds: string[] = [];
  if (existsSync(lessonsPath)) {
    const store = new LessonsStore(lessonsPath);
    relevantLessonIds = store.retrieveLessons(opts.objective).map((l) => l.id);
  }

  return {
    repoRoot,
    harnessRoot,
    resourceModules,
    lessonsPath,
    sources,
    relevantLessonIds,
  };
}

/** Serialize catalog for LLM fitter prompt (truncated). */
export function catalogSummary(catalog: ResourcesCatalog, maxChars = 4000): string {
  const lines = [
    `Harness root: ${catalog.harnessRoot}`,
    `Resource modules: ${catalog.resourceModules.join(", ") || "(none)"}`,
    `Relevant lessons: ${catalog.relevantLessonIds.join(", ") || "(none)"}`,
    "Sources:",
    ...catalog.sources.map((s) => `  - [${s.kind}] ${s.path} ${s.exists ? "✓" : "✗"}${s.summary ? ` — ${s.summary}` : ""}`),
  ];
  const text = lines.join("\n");
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}
