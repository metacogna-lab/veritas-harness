/**
 * Control plane — the natural-language front door.
 *
 * Resolves a plain-English objective + a target into a Mission (scope built by
 * the chosen Loadout's target adapter), wires the FULL safety spine (scope +
 * approval) and the evidence gate into the Mission, runs the Agent on the
 * shared loop, and persists the resulting snapshot for later `status`/`report`.
 *
 * Generic 8-plane version: accepts objective/target/loadout/role directly.
 * For research-plan-aware orchestration (ingest, eval, digest, RSI), see
 * harness/veritas-example which extends this with the research domain.
 *
 * The LLM is injected so this is testable without network. The CLI (`cli.ts`)
 * is a thin argv wrapper that builds a real LLM from config and calls this.
 */
import type { LLMBackbone } from "@spine/llm/index.ts";
import { Mission } from "@spine/mission/index.ts";
import type { MissionSnapshot, MissionStatus } from "@spine/mission/types.ts";
import { Agent, type AgentResult } from "../agent/index.ts";
import { LoadoutRegistry, type Loadout } from "../agent/specialists.ts";
import { starterRegistry, type ToolRegistry } from "@spine/tools/index.ts";
import { makeRecordFindingTool } from "@spine/tools/record-finding.ts";
import { evidenceGate } from "@spine/evidence/gate.ts";
import { promoteFinding } from "@spine/evidence/refuter.ts";
import { createSafetyCheck, type ApprovalPolicy } from "@spine/safety/index.ts";
import { MissionStore } from "@spine/control/store.ts";
import type { MissionScope } from "@spine/safety/scope.ts";

export interface StartOptions {
  objective: string;
  /** Domain target (e.g. a directory for codebase-audit, hosts for web-recon). */
  target: string;
  /** Explicit scope override; defaults to the loadout's target adapter output. */
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
}

export interface StartResult {
  id: string;
  result: AgentResult;
  snapshot: MissionSnapshot;
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
    /** Inject loadouts; defaults to an empty registry (no loadouts). */
    loadouts?: LoadoutRegistry;
    tools?: ToolRegistry;
    /** If provided, proposed findings are refuted before the report is written. */
    refuterLLM?: LLMBackbone;
  }) {
    this.llm = opts.llm;
    this.store = opts.store;
    this.loadouts = opts.loadouts ?? new LoadoutRegistry();
    this.tools = opts.tools ?? starterRegistry();
    this.refuterLLM = opts.refuterLLM;
  }

  /** Resolve which loadout serves an objective. Explicit name wins; else first. */
  resolveLoadout(name?: string): Loadout {
    if (name) {
      const l = this.loadouts.get(name);
      if (!l) throw new Error(`unknown loadout "${name}". Available: ${this.loadouts.list().map((x) => x.name).join(", ")}`);
      return l;
    }
    const first = this.loadouts.list()[0];
    if (!first) throw new Error("no loadouts registered — inject a LoadoutRegistry with at least one loadout");
    return first;
  }

  async start(opts: StartOptions): Promise<StartResult> {
    const emit = opts.onEvent ?? (() => {});

    const loadout = this.resolveLoadout(opts.loadout);
    const specialist = loadout.specialists.find((s) => s.role === opts.role) ?? loadout.specialists[0];
    if (!specialist) throw new Error(`loadout "${loadout.name}" has no specialists`);

    const scope = opts.scopeOverride ?? loadout.targetAdapter.buildScope(opts.target);
    const mission = new Mission({ objective: opts.objective, scope, findingValidator: evidenceGate });

    emit(`mission ${mission.id} started`);
    emit(`loadout: ${loadout.name} | ${loadout.targetAdapter.describeScope(scope)}`);

    const safetyCheck = createSafetyCheck({ scope, policy: opts.policy });
    const registry = this.tools.subset(loadout.toolNames);
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

    // Refute before confirm (invariant #4).
    if (this.refuterLLM) {
      const proposed = mission.findings.filter((f) => f.status === "proposed");
      for (const f of proposed) {
        const verdict = await promoteFinding(mission, f.id, this.refuterLLM);
        emit(`refuter: finding ${f.id} → ${verdict.verdict} (${verdict.reason})`);
      }
    }

    const snapshot = mission.snapshot();
    this.store.save(snapshot);

    emit(`mission ${mission.id} ${result.status}`);
    return { id: mission.id, result, snapshot };
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
