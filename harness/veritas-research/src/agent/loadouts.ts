/**
 * Two concrete example loadouts, proving the harness is multi-purpose: both run
 * on the SAME loop/gates/ledger and differ only in tools, prompts, and target
 * adapter. Registering a third domain requires no change to any core module.
 */
import type { MissionScope } from "../safety/scope.ts";
import type { Loadout, TargetAdapter } from "./specialists.ts";
import { LoadoutRegistry } from "./specialists.ts";

const EVIDENCE_RULE =
  "Every claim you make MUST be backed by a specific tool observation already in the " +
  "transcript. Never assert something you have not observed through a tool. If you cannot " +
  "support a claim with evidence, do not make it.";

const RECORD_RULE =
  "When you reach an evidence-backed conclusion, call record_finding with the claim and the " +
  "seq number of the observation that supports it BEFORE giving your final answer.";

/** Filesystem target: a directory tree the mission may read. */
const filesystemAdapter: TargetAdapter = {
  name: "filesystem",
  buildScope: (target: string): MissionScope => ({ hosts: [], paths: [target] }),
  describeScope: (scope: MissionScope) => `filesystem paths in scope: ${scope.paths.join(", ") || "(none)"}`,
};

/** Web target: a set of authorized hosts the mission may GET. */
const webHostAdapter: TargetAdapter = {
  name: "web-host",
  buildScope: (target: string): MissionScope => ({ hosts: target.split(",").map((h) => h.trim()).filter(Boolean), paths: [] }),
  describeScope: (scope: MissionScope) => `authorized hosts in scope: ${scope.hosts.join(", ") || "(none)"}`,
};

export const codebaseAuditLoadout: Loadout = {
  name: "codebase-audit",
  description: "Read and summarize/audit a codebase within a filesystem scope.",
  toolNames: ["read_file", "list_dir", "record_finding"],
  targetAdapter: filesystemAdapter,
  specialists: [
    {
      role: "auditor",
      toolAllowlist: ["read_file", "list_dir", "record_finding"],
      systemPrompt:
        "You are a meticulous code auditor. You explore a codebase using read_file and " +
        "list_dir, staying strictly within the mission scope, and report findings grounded " +
        `in what you read. ${EVIDENCE_RULE} ${RECORD_RULE}`,
    },
  ],
};

export const webReconLoadout: Loadout = {
  name: "web-recon",
  description: "Gather information from a set of explicitly authorized web hosts.",
  toolNames: ["http_get", "read_file", "record_finding"],
  targetAdapter: webHostAdapter,
  specialists: [
    {
      role: "recon",
      toolAllowlist: ["http_get", "read_file", "record_finding"],
      systemPrompt:
        "You gather information only from hosts explicitly authorized in the mission scope " +
        "using http_get. You never attempt hosts outside scope. You report only what the " +
        `responses actually show. ${EVIDENCE_RULE} ${RECORD_RULE}`,
    },
  ],
};

/** A registry pre-loaded with the two example loadouts. */
export function defaultLoadouts(): LoadoutRegistry {
  return new LoadoutRegistry().register(codebaseAuditLoadout).register(webReconLoadout);
}
