/**
 * CLI entry for `veritas rsi` — fixtures dry-run by default; `--last-n` mines
 * the experience store; `--llm` uses a real proposer (still no auto-apply).
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runRsi, summarizeRun } from "./run.ts";
import type { Proposer } from "./proposal.ts";
import type { FailureObservation, RegressionSuite } from "./types.ts";
import { DEFAULT_EDITABLE_SURFACES } from "./editable-surfaces.ts";
import { createLlmProposer } from "./llm-proposer.ts";
import { createCandidateRunTests } from "./candidate-runner.ts";
import { writeLoadoutCandidateArtifacts } from "./candidate-artifacts.ts";
import { LessonsStore } from "../resources/lessons.ts";
import type { ILLMBackbone } from "@spine/llm/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");
const HARNESS_ROOT = join(HERE, "..", "..");
const DEFAULT_EXPERIENCE = join(HARNESS_ROOT, "resources", "experience");

/** Deterministic placeholder — emits a review stub, never a real self-edit. */
const placeholderProposer: Proposer = async (ctx) => ({
  id: `dry-${ctx.pattern.id}`,
  patternId: ctx.pattern.id,
  targetPath: ctx.editableSurfaces[0]!.path,
  description: `(dry-run) would address "${ctx.pattern.signature}"`,
  diff: "(dry-run: no diff generated — a real proposer model produces this)",
  rationale: "dry-run scaffold; a human authors the real edit",
});

export interface RsiCliOptions {
  lastN?: number;
  llm?: boolean;
  llmBackbone?: ILLMBackbone;
  experienceStoreRoot?: string;
  candidatePath?: string;
  suite?: string;
  lessonsPath?: string;
}

export async function runRsiCli(opts: RsiCliOptions = {}): Promise<string> {
  const experienceStoreRoot = opts.experienceStoreRoot ?? DEFAULT_EXPERIENCE;
  const suite = JSON.parse(readFileSync(join(FIXTURES, "suite.json"), "utf8")) as RegressionSuite;
  const editableSurfaces = DEFAULT_EDITABLE_SURFACES;

  let proposer: Proposer = placeholderProposer;
  if (opts.llm) {
    if (!opts.llmBackbone) throw new Error("rsi --llm requires an LLM backbone");
    proposer = createLlmProposer(opts.llmBackbone);
  }

  const runTests = createCandidateRunTests({
    harnessRoot: HARNESS_ROOT,
    candidatePath: opts.candidatePath,
    suite: opts.suite,
  });

  const lessonsPath = opts.lessonsPath ?? join(HARNESS_ROOT, "resources", "lessons.json");
  const lessonsStore = existsSync(lessonsPath) ? new LessonsStore(lessonsPath) : undefined;

  const useStore = opts.lastN !== undefined && opts.lastN > 0;
  let failures: FailureObservation[] | undefined;
  if (!useStore) {
    failures = JSON.parse(readFileSync(join(FIXTURES, "failures.json"), "utf8")) as FailureObservation[];
  }

  const result = await runRsi({
    failures,
    lastN: useStore ? opts.lastN : undefined,
    experienceStoreRoot: useStore ? experienceStoreRoot : undefined,
    editableSurfaces,
    behaviorsToPreserve: ["scope deny-by-default", "provenance before claim", "human before consequence"],
    suite,
    proposer,
    runTests,
    lessonsStore,
  });

  const artifactNotes: string[] = [];
  for (const o of result.outcomes) {
    const paths = writeLoadoutCandidateArtifacts(HARNESS_ROOT, o.packet);
    artifactNotes.push(`artifact: ${paths.dir}`);
  }

  const mode = useStore ? `experience last-n=${opts.lastN}` : "fixtures";
  const proposerLabel = opts.llm ? "llm" : "placeholder";
  return (
    `${summarizeRun(result)}\n` +
    `mode: ${mode}; proposer: ${proposerLabel}\n` +
    (artifactNotes.length ? artifactNotes.join("\n") + "\n" : "") +
    `(human-gated: nothing applied to disk — see docs/adr/001-rsi-no-auto-apply.md)`
  );
}

/** Back-compat: fixture dry-run with placeholder proposer. */
export async function rsiDryRun(): Promise<string> {
  return runRsiCli({});
}
