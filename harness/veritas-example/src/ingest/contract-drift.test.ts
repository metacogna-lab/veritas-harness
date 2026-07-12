/**
 * Contract drift-guard (closes veritas-v0.2 C-1 and C-2).
 *
 * The verified & validated data model (ResearchPlan schema + Dogma Gate) and the
 * ingest compiler exist as a VENDORED COPY in two places: the repo-level contract
 * package `core/` (consumed by the Next.js app) and this harness (consumed by the
 * CLI + control plane). Vendoring is deliberate — the harness Docker image must not
 * depend on repo-root siblings. The price of vendoring is drift, so this test is the
 * enforceable replacement for the old manual "just copy the file" sync policy.
 *
 * It compares the two copies as TEXT (no cross-package import, so no module-resolution
 * or missing-dependency risk) and fails CI the moment they diverge on anything that
 * changes gate behaviour or drops a security invariant.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const HARNESS_ROOT = process.cwd(); // bun test runs with cwd = harness/veritas-example
const REPO_ROOT = join(HARNESS_ROOT, "..", "..");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

/** Extract the ordered set of `{ id, required }` pairs from a dogma module's source. */
function dogmaDimensions(src: string): Array<{ id: string; required: boolean }> {
  const out: Array<{ id: string; required: boolean }> = [];
  // Each dimension block opens `id: "<x>"` and declares `required: <bool>` shortly after.
  const re = /id:\s*"([a-z-]+)"[\s\S]*?required:\s*(true|false)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out.push({ id: m[1]!, required: m[2] === "true" });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** Extract top-level Zod object field names from a schema module's source. */
function schemaTopFields(src: string): string[] {
  // researchPlanSchema = z.object({ version: ..., metadata: ..., objective: ... })
  const block = src.match(/researchPlanSchema\s*=\s*z\.object\(\{([\s\S]*?)\}\)/);
  if (!block) return [];
  const fields = new Set<string>();
  // Only match keys at the top indentation level (two spaces) to avoid nested keys.
  const re = /^\s{2}([a-zA-Z_]+):/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block[1]!)) !== null) fields.add(m[1]!);
  return [...fields].sort();
}

describe("contract drift-guard: core/ ↔ harness (C-1)", () => {
  it("Dogma Gate dimensions (id + required) are identical", () => {
    const core = dogmaDimensions(read(join(REPO_ROOT, "core", "dogma.ts")));
    const harness = dogmaDimensions(read(join(HARNESS_ROOT, "src", "config", "dogma.ts")));
    expect(harness.length).toBeGreaterThanOrEqual(8);
    expect(harness).toEqual(core);
  });

  it("ResearchPlan schema top-level fields are identical", () => {
    const core = schemaTopFields(read(join(REPO_ROOT, "core", "schema.ts")));
    const harness = schemaTopFields(read(join(HARNESS_ROOT, "src", "ingest", "schema.ts")));
    expect(harness.length).toBeGreaterThan(5);
    expect(harness).toEqual(core);
  });
});

describe("ingest compiler drift-guard: security invariant (C-2)", () => {
  const coreCompiler = read(join(REPO_ROOT, "core", "compile-brief.ts"));
  const harnessCompiler = read(join(HARNESS_ROOT, "src", "ingest", "fit-intent.ts"));

  it("both compilers mark intent as UNTRUSTED DATA (prompt-injection defence)", () => {
    expect(coreCompiler).toContain("UNTRUSTED DATA");
    expect(harnessCompiler).toContain("UNTRUSTED DATA");
  });

  it("both compilers constrain output to a single JSON object", () => {
    expect(coreCompiler.toLowerCase()).toContain("json object");
    expect(harnessCompiler.toLowerCase()).toContain("json object");
  });
});
