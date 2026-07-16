#!/usr/bin/env bun
/**
 * Generate the committed INT smoke artifact.
 *
 * Runs the FULL INT spine deterministically (control plane → agent records a
 * finding through the evidence gate → refuter promotes it) with fake, scripted
 * LLMs, and writes the resulting mission snapshot to bench/int-smoke/mission.json
 * plus a claims.json entry. `verify-claims` then re-derives the headline number
 * ("1 confirmed finding") from that committed snapshot — proving reproducibility.
 *
 * Re-run this whenever the spine changes so the golden artifact stays in sync:
 *   bun scripts/gen-int-smoke.mjs
 */
import { mkdirSync, writeFileSync, mkdtempSync, writeFileSync as wf } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ControlPlane } from "../src/control/plane.ts";
import { MissionStore } from "../../../core/spine/control/store.ts";
import { LLMBackbone } from "../../../core/spine/llm/index.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = { provider: "anthropic", model: "fake", apiKey: "sk-x-000000000000", baseUrl: "http://localhost", maxTokens: 100, temperature: 0 };
const zero = { inputTokens: 0, outputTokens: 0 };

// A code file to audit, inside the mission scope.
const dir = mkdtempSync(join(tmpdir(), "veritas-int-smoke-"));
const file = join(dir, "app.ts");
wf(file, "export const debug = true;\n", "utf8");

// The read observation lands at seq 4 (0 objective, 1 status, 2 model, 3 tool_call, 4 observation).
const READ_OBS_SEQ = 4;

function scripted(responses) {
  let i = 0;
  const transport = async () => responses[Math.min(i++, responses.length - 1)];
  return new LLMBackbone({ configs: [cfg], transport, sleep: async () => {} });
}

const mainLLM = scripted([
  { text: "", nativeToolCalls: [{ name: "read_file", input: { path: file } }], usage: zero },
  { text: "", nativeToolCalls: [{ name: "record_finding", input: { claim: "debug = true", observationSeq: READ_OBS_SEQ } }], usage: zero },
  { text: "app.ts sets debug = true.", usage: zero },
]);

// Evidence-grounded skeptic: confirms only when the evidence contains the claim.
const refuterLLM = (() => {
  const transport = async (_c, req) => {
    const content = req.messages[0].content;
    const claim = content.split("CLAIM:\n")[1].split("\n\nEVIDENCE")[0].trim().toLowerCase();
    const evidence = content.split("EVIDENCE")[1].toLowerCase();
    const supported = evidence.includes(claim);
    return { text: JSON.stringify({ verdict: supported ? "confirmed" : "retracted", reason: supported ? "evidence supports claim" : "unsupported" }), usage: zero };
  };
  return new LLMBackbone({ configs: [cfg], transport, sleep: async () => {} });
})();

const runsDir = mkdtempSync(join(tmpdir(), "veritas-int-runs-"));
const plane = new ControlPlane({ llm: mainLLM, store: new MissionStore(runsDir), refuterLLM });
const { snapshot } = await plane.start({ objective: "audit app.ts for a debug flag", target: dir, loadout: "codebase-audit" });

const confirmed = snapshot.findings.filter((f) => f.status === "confirmed").length;

// Normalize volatile fields so the committed artifact is stable across runs.
const stable = {
  ...snapshot,
  id: "int-smoke",
  scope: { hosts: [], paths: ["<scope-path>"] },
  transcript: snapshot.transcript.map((e) => ({ ...e, timestamp: "<ts>", meta: redactPaths(e.meta) })),
  findings: snapshot.findings.map((f) => ({ ...f, id: "finding-1", createdAt: "<ts>" })),
};
function redactPaths(meta) {
  if (!meta) return meta;
  const out = { ...meta };
  if (typeof out.input === "object" && out.input && "path" in out.input) out.input = { ...out.input, path: "<scope-path>/app.ts" };
  return out;
}

const outDir = join(ROOT, "bench", "int-smoke");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "mission.json"), JSON.stringify(stable, null, 2), "utf8");

const claims = [
  {
    id: "int-smoke-confirmed",
    statement: "The INT smoke mission produced exactly 1 confirmed finding.",
    kind: "findings_count",
    args: { snapshot: "bench/int-smoke/mission.json", status: "confirmed" },
    value: confirmed,
  },
];
writeFileSync(join(ROOT, "claims.json"), JSON.stringify(claims, null, 2), "utf8");

console.log(`wrote bench/int-smoke/mission.json (confirmed findings: ${confirmed})`);
console.log("wrote claims.json");
