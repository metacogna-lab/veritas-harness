/**
 * record_finding — the agent's path to propose a finding.
 *
 * This is how a claim enters the ledger: the model calls record_finding with a
 * claim and the seq of the observation that supports it. The tool looks up that
 * observation, fills provenance from it, and routes through Mission.addFinding —
 * which applies the evidence/provenance gate (invariant #3). A claim without a
 * real backing observation is rejected and the rejection is returned to the
 * model as the observation, so it learns it must ground its claims.
 *
 * riskTier `safe`: no external side effect (it writes only to the in-memory,
 * append-only mission log). Bound to a specific mission via a factory.
 */
import { z } from "zod";
import type { Tool } from "./registry.ts";
import type { Mission } from "../mission/index.ts";

const inputSchema = z.object({
  claim: z.string().min(1).describe("The evidence-backed claim to record."),
  observationSeq: z
    .number()
    .int()
    .nonnegative()
    .describe("The transcript seq of the observation that supports this claim."),
});
type Input = z.infer<typeof inputSchema>;

export function makeRecordFindingTool(mission: Mission): Tool<Input> {
  return {
    name: "record_finding",
    description:
      "Record an evidence-backed finding. Provide the claim and the seq of the observation " +
      "that supports it. Findings with no real backing observation are rejected.",
    inputSchema,
    riskTier: "safe",
    run: async (input) => {
      const entry = mission.entries.find((e) => e.seq === input.observationSeq);
      const toolCall = typeof entry?.meta?.tool === "string" ? entry.meta.tool : "unknown";
      const res = mission.addFinding({
        claim: input.claim,
        provenance: { toolCall, observationSeq: input.observationSeq },
      });
      if (res.accepted) {
        return `finding recorded (id=${res.finding.id}, status=proposed): ${input.claim}`;
      }
      return `FINDING REJECTED: ${res.reason}`;
    },
  };
}
