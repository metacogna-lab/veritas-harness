#!/usr/bin/env bash
# Test create-harness for solo-hackathon + execute Step 1 as a mission.
# Errors → agents/errors/{process}-{datetime}-*.log
# Output → logs/*.{md,log}
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DT="$(date -u +"%Y-%m-%dT%H%M%SZ")"
HARNESS_NAME="solo-hackathon"
SPEC="agents/specs/solo-hackathon.json"

mkdir -p agents/errors logs

CREATE_OUT="logs/create-harness-${DT}.log"
CREATE_ERR="agents/errors/create-harness-${DT}.log"
STEP1_OUT="logs/step1-mission-${DT}.log"
STEP1_ERR="agents/errors/step1-mission-${DT}.log"
SUMMARY="logs/solo-hackathon-run-${DT}.md"

echo "=== solo-hackathon harness test @ ${DT} ===" | tee "$CREATE_OUT"
echo "branch: $(git branch --show-current)" | tee -a "$CREATE_OUT"
echo "spec: ${SPEC}" | tee -a "$CREATE_OUT"
: > "$CREATE_ERR"

# --- create-harness (invoke bun meta/… so --from-spec is not swallowed) ---
set +e
bun meta/create-harness.ts "$HARNESS_NAME" --from-spec "$SPEC" >>"$CREATE_OUT" 2>>"$CREATE_ERR"
CREATE_RC=$?
set -e
if [[ $CREATE_RC -ne 0 ]]; then
  echo "EXIT ${CREATE_RC}" >> "$CREATE_ERR"
  cat "$CREATE_OUT" >> "$CREATE_ERR"
fi
echo "create-harness rc=${CREATE_RC}" | tee -a "$CREATE_OUT"

# --- Step 1 mission (problem framing) ---
: > "$STEP1_OUT"
: > "$STEP1_ERR"
set +e
if [[ ! -d "harness/${HARNESS_NAME}" ]]; then
  echo "SKIP step1: harness/${HARNESS_NAME} missing" | tee -a "$STEP1_ERR" "$STEP1_OUT"
  STEP1_RC=1
else
  cat > "harness/${HARNESS_NAME}/HACKATHON.md" <<'EOF'
# Solo Hackathon — Step Guide

## Step 1 — Problem framing (this mission)
Define:
1. The single problem a solo builder can finish in one sitting
2. Hard constraints (time, tools, out-of-scope)
3. Measurable success criteria (demo-ready artefact)

## Step 2 — Scope the MVP
## Step 3 — Build sprint
## Step 4 — Demo package
EOF

  (
    cd "harness/${HARNESS_NAME}"
    bun ./src/cli.ts loadouts
    echo "---"
    bun -e '
import { Mission } from "./src/mission/index.ts";
import { ToolRegistry } from "./src/tools/registry.ts";
import { readFile } from "./src/tools/read-file.ts";
import { runAgent, scopeOnlyCheck } from "./src/agent/index.ts";
import { ScriptedBackbone } from "./src/llm/echo.ts";
import { defaultLoadouts } from "./src/agent/loadouts.ts";
import { writeFileSync } from "node:fs";

const cwd = process.cwd();
const objective =
  "Step 1 — Problem framing for a single-person hackathon: read HACKATHON.md and summarise the problem, constraints, and success criteria.";

const mission = new Mission(objective, { hosts: [], paths: [cwd] });
const registry = new ToolRegistry().register(readFile);
const loadouts = defaultLoadouts();
const loadout = loadouts.get("solo-hackathon");
console.log("loadouts:", loadouts.list().map((l) => l.name).join(", ") || "(none)");
console.log("using loadout:", loadout?.name ?? "(missing)");

const llm = new ScriptedBackbone([
  {
    text: "Reading the hackathon brief for Step 1 problem framing.",
    toolCalls: [{ name: "read_file", input: { path: `${cwd}/HACKATHON.md` } }],
  },
  {
    text: JSON.stringify({
      action: "final",
      answer:
        "Step 1 framed: solo builder ships one sitting-sized artefact under stated constraints; success = demo-ready output matching HACKATHON.md criteria.",
    }),
    toolCalls: [],
  },
]);

const result = await runAgent({
  llm,
  registry,
  mission,
  system: loadout?.specialists[0]?.systemPrompt ?? "You facilitate solo hackathons.",
  safetyCheck: scopeOnlyCheck(mission.scope),
  maxSteps: 4,
});

const ok = Boolean(result.answer) && mission.log.length >= 1 && !result.stopped;
const report = {
  process: "step1-mission",
  step: 1,
  title: "Problem framing",
  status: ok ? "ok" : "incomplete",
  answer: result.answer,
  steps: result.steps,
  observations: mission.log.length,
  findings: mission.findings.length,
  loadout: loadout?.name ?? null,
  maxStepsHit: result.stopped,
};
console.log(JSON.stringify(report, null, 2));
writeFileSync("step1-mission-result.json", JSON.stringify(report, null, 2) + "\n");
process.exit(ok ? 0 : 1);
'
    MISSION_RC=$?
    echo "---"
    bun ./src/cli.ts smoke
    exit "$MISSION_RC"
  ) >>"$STEP1_OUT" 2>>"$STEP1_ERR"
  STEP1_RC=$?
fi
set -e

if [[ $STEP1_RC -ne 0 ]]; then
  echo "EXIT ${STEP1_RC}" >> "$STEP1_ERR"
  cat "$STEP1_OUT" >> "$STEP1_ERR"
fi

{
  echo "# Solo hackathon harness test"
  echo
  echo "- **datetime (UTC):** ${DT}"
  echo "- **branch:** \`$(git branch --show-current)\`"
  echo "- **spec:** \`${SPEC}\`"
  echo "- **create-harness exit:** ${CREATE_RC}"
  echo "- **step1-mission exit:** ${STEP1_RC}"
  echo
  echo "## Artefacts"
  echo
  echo "| kind | path |"
  echo "|---|---|"
  echo "| create stdout | \`${CREATE_OUT}\` |"
  echo "| create errors | \`${CREATE_ERR}\` |"
  echo "| step1 stdout | \`${STEP1_OUT}\` |"
  echo "| step1 errors | \`${STEP1_ERR}\` |"
  if [[ -d "harness/${HARNESS_NAME}" ]]; then
    echo "| harness | \`harness/${HARNESS_NAME}/\` |"
    echo "| HARNESS_SPEC | \`harness/${HARNESS_NAME}/HARNESS_SPEC.json\` |"
    [[ -f "harness/${HARNESS_NAME}/step1-mission-result.json" ]] && \
      echo "| step1 result | \`harness/${HARNESS_NAME}/step1-mission-result.json\` |"
  fi
  echo
  echo "## Verdict"
  echo
  if [[ $CREATE_RC -eq 0 && $STEP1_RC -eq 0 ]]; then
    echo "**PASS** — harness created from spec; Step 1 mission completed."
  elif [[ $CREATE_RC -eq 0 ]]; then
    echo "**PARTIAL** — harness created; Step 1 mission failed (see \`${STEP1_ERR}\`)."
  else
    echo "**FAIL** — create-harness failed (see \`${CREATE_ERR}\`)."
  fi
} > "$SUMMARY"

echo
echo "=== summary: ${SUMMARY} ==="
cat "$SUMMARY"
exit $(( CREATE_RC != 0 ? CREATE_RC : STEP1_RC ))
