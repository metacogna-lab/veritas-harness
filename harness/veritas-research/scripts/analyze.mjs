#!/usr/bin/env bun
/**
 * analyze.mjs — produce analysis/research-analysis-{datetime}.md at repo root.
 *
 * Reads each harness under harness/, then synthesises an overall + per-harness
 * report covering: summary, recent changes, confirmed findings, lessons, and
 * current hypotheses.
 *
 *   bun scripts/analyze.mjs               # write to analysis/
 *   bun scripts/analyze.mjs --dry-run     # print to stdout only
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const HARNESS_DIR = join(SCRIPT_DIR, "..");     // harness/veritas-research/
const REPO_ROOT = join(HARNESS_DIR, "..", ".."); // repo root
const ANALYSIS_DIR = join(REPO_ROOT, "analysis");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

// ── helpers ──────────────────────────────────────────────────────────────────

function readJSON(p) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function git(cmd, cwd) {
  try {
    return execSync(cmd, { cwd: cwd ?? REPO_ROOT, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function isoNow() {
  return new Date().toISOString();
}

function slugDate(iso) {
  return iso.replace(/[:.]/g, "-").replace("T", "T").slice(0, 19);
}

// ── harness discovery ────────────────────────────────────────────────────────

function discoverHarnesses() {
  const harnessRoot = join(REPO_ROOT, "harness");
  if (!existsSync(harnessRoot)) return [];
  return readdirSync(harnessRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, path: join(harnessRoot, e.name) }));
}

// ── per-harness data collection ───────────────────────────────────────────────

function collectHarnessData(harness) {
  const { name, path } = harness;

  // Recent git log (last 10 commits touching this harness)
  const log = git(
    `git log --oneline -10 -- harness/${name}/`,
    REPO_ROOT
  );

  // claims.json
  const claims = readJSON(join(path, "claims.json")) ?? [];

  // lessons.json
  const lessons = readJSON(join(path, "resources", "lessons.json")) ?? [];

  // bench results (one per suite under bench/)
  const benchDir = join(path, "bench");
  const benchResults = [];
  if (existsSync(benchDir)) {
    for (const suite of readdirSync(benchDir, { withFileTypes: true })) {
      if (!suite.isDirectory()) continue;
      const results = readJSON(join(benchDir, suite.name, "results.json"));
      if (results) benchResults.push({ suite: suite.name, results });
    }
  }

  // missions — collect slug + objective from research-plan.json
  const missionsDir = join(path, "missions");
  const missions = [];
  if (existsSync(missionsDir)) {
    for (const slug of readdirSync(missionsDir, { withFileTypes: true })) {
      if (!slug.isDirectory() || slug.name === ".gitkeep") continue;
      const plan = readJSON(join(missionsDir, slug.name, "research-plan.json"));
      if (plan) missions.push({ slug: slug.name, objective: plan.objective, loadout: plan.loadout });
    }
  }

  // package.json version
  const pkg = readJSON(join(path, "package.json"));

  return { name, path, log, claims, lessons, benchResults, missions, version: pkg?.version ?? "unknown" };
}

// ── section renderers ─────────────────────────────────────────────────────────

function renderClaims(claims) {
  if (!claims.length) return "_None recorded._";
  return claims
    .map((c) => `- **${c.id}**: ${c.statement} (value: \`${c.value}\`)`)
    .join("\n");
}

function renderLessons(lessons) {
  if (!lessons.length) return "_None recorded._";
  return lessons
    .map((l) => {
      const worked = l.worked?.length ? `worked: ${l.worked.join("; ")}` : "";
      const failed = l.failed?.length ? `failed: ${l.failed.join("; ")}` : "";
      const gaps = l.gaps?.length ? `gaps: ${l.gaps.join("; ")}` : "";
      const detail = [worked, failed, gaps].filter(Boolean).join(" | ");
      return `- **${l.id}** (\`${l.missionId}\`): ${l.objective}${detail ? `\n  ${detail}` : ""}`;
    })
    .join("\n");
}

function renderBench(benchResults) {
  if (!benchResults.length) return "_No benchmark suites run._";
  return benchResults
    .map(({ suite, results }) => {
      const lines = [`- **${suite}**:`];
      if (results?.summary) {
        // Structured harness results with summary block
        for (const [mode, stats] of Object.entries(results.summary)) {
          const ci = stats.wilson95
            ? ` (95% CI ${stats.wilson95.low.toFixed(2)}–${stats.wilson95.high.toFixed(2)})`
            : "";
          lines.push(`  - ${mode}: pass@1=${stats.pass_at_1} n=${stats.n}${ci}`);
        }
      } else if (Array.isArray(results)) {
        for (const r of results) {
          lines.push(`  - mode=${r.mode} pass@1=${r.passAt1} n=${r.n}`);
        }
      } else {
        lines.push(`  - (raw) ${JSON.stringify(results)}`);
      }
      return lines.join("\n");
    })
    .join("\n");
}

function renderMissions(missions) {
  if (!missions.length) return "_No ingested missions._";
  return missions
    .map((m) => `- **${m.slug}** (loadout: \`${m.loadout}\`): ${m.objective}`)
    .join("\n");
}

function renderHarness(data) {
  const confirmedFindings = data.claims.filter((c) => c.kind === "findings_count").length;
  const benchPassed = data.claims.filter((c) => c.kind === "bench_pass_at_1" && c.value === 1).length;

  const recentLog = data.log
    ? data.log.split("\n").slice(0, 5).map((l) => `    ${l}`).join("\n")
    : "    (no git history)";

  return `
# ${data.name} (harness/${data.name})

**Version:** ${data.version}

## SUMMARY

Harness path: \`harness/${data.name}/\`

Claims verified: ${data.claims.length} | Bench suites passed: ${benchPassed} | Lessons recorded: ${data.lessons.length} | Ingested missions: ${data.missions.length}

### Claims

${renderClaims(data.claims)}

### Benchmark Results

${renderBench(data.benchResults)}

### Ingested Missions

${renderMissions(data.missions)}

### Lessons

${renderLessons(data.lessons)}

## CHANGES

Recent commits touching this harness:

\`\`\`
${recentLog}
\`\`\`

## CURRENT HYPOTHESIS

${
    data.missions.length
      ? `Active research objectives:\n${data.missions.map((m) => `- ${m.objective}`).join("\n")}`
      : "No active ingested research plan. Run `bun run ingest --input ingest/NEW.md` to start a new mission."
  }

${
    benchPassed > 0
      ? `Safety properties under test: scope-gate pass@1 verified (${benchPassed} claim(s)).`
      : "Benchmark evidence pending — run `bun run bench` to establish baseline."
  }
`.trimStart();
}

// ── overall summary ──────────────────────────────────────────────────────────

function renderOverall(allData, generatedAt) {
  const totalClaims = allData.reduce((s, d) => s + d.claims.length, 0);
  const totalLessons = allData.reduce((s, d) => s + d.lessons.length, 0);
  const totalMissions = allData.reduce((s, d) => s + d.missions.length, 0);
  const harnessList = allData.map((d) => `- \`harness/${d.name}\` v${d.version}`).join("\n");
  const branch = git("git rev-parse --abbrev-ref HEAD");
  const head = git("git rev-parse --short HEAD");

  return `# OVERALL SUMMARY (All harnesses)

**Generated:** ${generatedAt}
**Branch:** ${branch} @ \`${head}\`
**Harnesses analysed:** ${allData.length}

${harnessList}

**Aggregate claims:** ${totalClaims} | **Lessons:** ${totalLessons} | **Ingested missions:** ${totalMissions}

${
    allData.length === 1
      ? `Single harness repo. See [${allData[0].name}](#${allData[0].name}) below for detail.`
      : allData
          .map((d) => `- **${d.name}**: ${d.claims.length} claims, ${d.lessons.length} lessons, ${d.missions.length} missions`)
          .join("\n")
  }

---
`;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const harnesses = discoverHarnesses();
  if (!harnesses.length) {
    console.error("analyze: no harnesses found under harness/");
    process.exit(1);
  }

  const allData = harnesses.map(collectHarnessData);
  const generatedAt = isoNow();

  const sections = [
    renderOverall(allData, generatedAt),
    ...allData.map(renderHarness),
  ];

  const report = sections.join("\n---\n\n");

  if (DRY_RUN) {
    process.stdout.write(report + "\n");
    return;
  }

  if (!existsSync(ANALYSIS_DIR)) mkdirSync(ANALYSIS_DIR, { recursive: true });

  const filename = `research-analysis-${slugDate(generatedAt)}.md`;
  const outputPath = join(ANALYSIS_DIR, filename);
  writeFileSync(outputPath, report + "\n", "utf8");
  console.log(`analyze: wrote ${outputPath}`);
}

main().catch((err) => {
  console.error(`analyze: ${err.message}`);
  process.exit(1);
});
