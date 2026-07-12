/**
 * Control plane — the natural-language front door.
 *
 * Resolves a plain-English objective + a target into a Mission (scope built by
 * the chosen Loadout's target adapter), wires the FULL safety spine (scope +
 * approval) and the evidence gate into the Mission, runs the Agent on the
 * shared loop, and persists the resulting snapshot for later `status`/`report`.
 *
 * The LLM is injected so this is testable without network. The CLI (`cli.ts`)
 * is a thin argv wrapper that builds a real LLM from config and calls this.
 */
import type { LLMBackbone } from "../llm/index.ts";
import { Mission } from "../mission/index.ts";
import type { MissionSnapshot, MissionStatus } from "../mission/types.ts";
import { Agent, type AgentResult } from "../agent/index.ts";
import { LoadoutRegistry, type Loadout } from "../agent/specialists.ts";
import { defaultLoadouts } from "../agent/loadouts.ts";
import { starterRegistry, type ToolRegistry } from "../tools/index.ts";
import { makeRecordFindingTool } from "../tools/record-finding.ts";
import { evidenceGate } from "../evidence/gate.ts";
import { promoteFinding } from "../evidence/refuter.ts";
import { createSafetyCheck, type ApprovalPolicy } from "../safety/index.ts";
import { MissionStore } from "./store.ts";
import type { ResearchPlan } from "../resources/research-plan.ts";
import { planToStartOptions } from "../resources/research-plan.ts";
import { evalPlanWithConfig, renderEvalReport } from "../resources/plan-eval.ts";
import { digestSources } from "../resources/source-digest.ts";
import { writeExperienceEntry, type HarnessConfigSnapshot } from "../mission/experience-store.ts";
import type { MissionScope } from "../safety/scope.ts";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface StartOptions {
  objective?: string;
  /** Domain target (e.g. a directory for codebase-audit, hosts for web-recon). */
  target?: string;
  /** Validated research plan from ingest; overrides objective/loadout/target/scope. */
  plan?: ResearchPlan;
  /** Explicit scope override (used with plan.scope). */
  scopeOverride?: MissionScope;
  /** Loadout name; defaults to the first registered loadout. */
  loadout?: string;
  /** Specialist role within the loadout; defaults to the first. */
  role?: string;
  maxSteps?: number;
  /** Approval policy for gated tiers (headless: pass a preAuthorized allowlist). */
  policy?: ApprovalPolicy;
  /** Event line sink (defaults to no-op; the CLI streams to stdout). */
  onEvent?: (line: string) => void;
  /**
   * Skip plan eval dogma gate (useful in tests with minimal fixture plans).
   * Production code should never set this.
   */
  skipPlanEval?: boolean;
  /** Skip source digest (e.g. dry-run or offline mode). */
  skipDigest?: boolean;
}

export interface StartResult {
  id: string;
  result: AgentResult;
  snapshot: MissionSnapshot;
}

/** Thrown when a research plan fails the dogma gate. Message is the full eval report. */
export class PlanEvalError extends Error {
  constructor(report: string) {
    super(report);
    this.name = "PlanEvalError";
  }
}

export class ControlPlane {
  private readonly loadouts: LoadoutRegistry;
  private readonly tools: ToolRegistry;
  private readonly store: MissionStore;
  private readonly llm: LLMBackbone;
  /** Optional distinct LLM used by the refuter (different model/temperature). */
  private readonly refuterLLM?: LLMBackbone;

  constructor(opts: {
    llm: LLMBackbone;
    store: MissionStore;
    loadouts?: LoadoutRegistry;
    tools?: ToolRegistry;
    /** If provided, proposed findings are refuted before the report is written. */
    refuterLLM?: LLMBackbone;
    /**
     * Root directory for the experience store (resources/experience/).
     * Defaults to <harnessRoot>/resources/experience. Injectable for tests.
     */
    experienceStoreRoot?: string;
  }) {
    this.llm = opts.llm;
    this.store = opts.store;
    this.loadouts = opts.loadouts ?? defaultLoadouts();
    this.tools = opts.tools ?? starterRegistry();
    this.refuterLLM = opts.refuterLLM;
    this.experienceStoreRoot =
      opts.experienceStoreRoot ??
      join(dirname(fileURLToPath(import.meta.url)), "..", "..", "resources", "experience");
  }

  private readonly experienceStoreRoot: string;

  /** Resolve which loadout serves an objective. Explicit name wins; else default. */
  resolveLoadout(name?: string): Loadout {
    if (name) {
      const l = this.loadouts.get(name);
      if (!l) throw new Error(`unknown loadout "${name}". Available: ${this.loadouts.list().map((x) => x.name).join(", ")}`);
      return l;
    }
    const first = this.loadouts.list()[0];
    if (!first) throw new Error("no loadouts registered");
    return first;
  }

  async start(opts: StartOptions): Promise<StartResult> {
    // Interface guard (v0.2 M-1): when a plan is supplied it is authoritative for
    // mission identity. Explicit objective/target that CONTRADICT the plan are a
    // caller error, not a silent override; consistent duplicates (as the CLI passes)
    // are fine. `loadout`/`role` remain intentional overrides. See PHASE2 B3 for the
    // discriminated-union end-state that makes this a type-level guarantee.
    if (opts.plan) {
      const conflicts: string[] = [];
      if (opts.objective !== undefined && opts.objective !== opts.plan.objective) conflicts.push("objective");
      if (opts.target !== undefined && opts.target !== opts.plan.target) conflicts.push("target");
      if (conflicts.length > 0) {
        throw new Error(
          `start: explicit ${conflicts.join(" and ")} contradict(s) the research plan — ` +
            `pass a plan OR explicit fields, not conflicting values`,
        );
      }
    }

    const mapped = opts.plan ? planToStartOptions(opts.plan) : undefined;
    const objective = mapped?.objective ?? opts.objective;
    const target = mapped?.target ?? opts.target;
    const loadoutName = mapped?.loadout ?? opts.loadout;
    const role = mapped?.role ?? opts.role;
    const emit = opts.onEvent ?? (() => {});

    // Plan eval dogma gate — required dimensions must pass before execution.
    if (opts.plan && !opts.skipPlanEval) {
      const evalResult = evalPlanWithConfig(opts.plan);
      if (!evalResult.pass) {
        throw new PlanEvalError(renderEvalReport(evalResult));
      }
      const advisoryFailed = evalResult.dimensions.filter((d) => !d.required && !d.pass);
      if (advisoryFailed.length > 0) {
        emit(`plan-eval: ⚠️  advisory: ${advisoryFailed.map((d) => d.id).join(", ")}`);
      }
      emit(`plan-eval: ✅ ${Math.round(evalResult.score * 100)}% (${evalResult.dimensions.filter((d) => d.pass).length}/${evalResult.dimensions.length} dimensions)`);
    }

    // Source digest — summarise plan sources before the agent loop starts.
    if (opts.plan && !opts.skipDigest && opts.plan.sources.filter((s) => s.kind !== "lesson").length > 0) {
      const harnessRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
      await digestSources({
        plan: opts.plan,
        harnessRoot,
        llm: this.llm,
        onEvent: emit,
      });
    }

    if (!objective || !target) {
      throw new Error("start requires objective and target, or a research plan");
    }

    const loadout = this.resolveLoadout(loadoutName);
    const specialist = loadout.specialists.find((s) => s.role === role) ?? loadout.specialists[0];
    if (!specialist) throw new Error(`loadout "${loadout.name}" has no specialists`);

    const scope =
      opts.scopeOverride ?? mapped?.scope ?? loadout.targetAdapter.buildScope(target);
    const mission = new Mission({ objective, scope, findingValidator: evidenceGate });

    emit(`mission ${mission.id} started`);
    emit(`loadout: ${loadout.name} | ${loadout.targetAdapter.describeScope(scope)}`);
    if (mapped?.planNote) mission.record("note", mapped.planNote);

    const safetyCheck = createSafetyCheck({ scope, policy: opts.policy });
    const registry = this.tools.subset(loadout.toolNames);
    // The finding-recording tool is bound to THIS mission (routes through the
    // evidence gate). Registered per-run since it closes over the mission.
    if (loadout.toolNames.includes("record_finding")) {
      registry.register(makeRecordFindingTool(mission));
    }
    const agent = new Agent({
      llm: this.llm,
      registry,
      specialist,
      mission,
      maxSteps: opts.maxSteps ?? 12,
      safetyCheck,
    });
    agent.on("toolCall", (i) => emit(`→ tool ${i.name}(${JSON.stringify(i.input)})`));
    agent.on("observation", (i) => emit(`← ${i.ok ? "ok" : "blocked"}: ${i.observation.slice(0, 200)}`));

    const result = await agent.run();

    const snapshot = await this.finalize(mission, loadout, scope, emit);

    emit(`mission ${mission.id} ${result.status}`);
    return { id: mission.id, result, snapshot };
  }

  /**
   * Post-run finalization (v0.2 M-2 — extracted from start() to lower the control
   * plane's coupling): refute every proposed finding (invariant #4), persist the
   * snapshot, and archive an experience entry for the RSI outer loop. Behaviour is
   * identical to the previous inline block; only the boundary is named.
   */
  private async finalize(
    mission: Mission,
    loadout: Loadout,
    scope: MissionScope,
    emit: (line: string) => void,
  ): Promise<MissionSnapshot> {
    // Refute before confirm (invariant #4): every proposed finding must survive
    // the refuter before it is reported as confirmed.
    if (this.refuterLLM) {
      const proposed = mission.findings.filter((f) => f.status === "proposed");
      for (const f of proposed) {
        const verdict = await promoteFinding(mission, f.id, this.refuterLLM);
        emit(`refuter: finding ${f.id} → ${verdict.verdict} (${verdict.reason})`);
      }
    }

    const snapshot = mission.snapshot();
    this.store.save(snapshot);

    // Write to the experience store for the RSI outer loop to query later.
    const harnessConfig: HarnessConfigSnapshot = {
      loadout: loadout.name,
      specialistRoles: loadout.specialists.map((s) => s.role),
      toolNames: loadout.toolNames,
      scopeHosts: scope.hosts,
      scopePaths: scope.paths,
    };
    try {
      writeExperienceEntry(this.experienceStoreRoot, snapshot, harnessConfig);
    } catch {
      emit(`experience-store: warn — could not write entry for ${mission.id}`);
    }

    return snapshot;
  }

  status(id: string): MissionStatus | undefined {
    return this.store.load(id)?.status;
  }

  /** A human-readable report re-derived from the committed snapshot. */
  report(id: string): string | undefined {
    const snap = this.store.load(id);
    if (!snap) return undefined;
    const lines = [
      `Mission ${snap.id}`,
      `Objective: ${snap.objective}`,
      `Status: ${snap.status}`,
      `Scope: hosts=[${snap.scope.hosts.join(", ")}] paths=[${snap.scope.paths.join(", ")}]`,
      `Transcript entries: ${snap.transcript.length}`,
      `Findings: ${snap.findings.length}`,
    ];
    for (const f of snap.findings) {
      lines.push(`  - [${f.status}] ${f.claim}${f.refutation ? ` (refuter: ${f.refutation})` : ""}`);
    }
    return lines.join("\n");
  }
}
