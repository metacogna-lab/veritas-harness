import { describe, expect, test } from "bun:test";
import { Mission } from "../mission/index.ts";
import { evidenceGate } from "./gate.ts";
import type { MissionScope } from "../safety/scope.ts";

const scope: MissionScope = { hosts: [], paths: ["/work"] };

function mission() {
  let n = 0;
  return new Mission({
    objective: "audit",
    scope,
    now: () => "t",
    idGen: () => `id-${n++}`,
    findingValidator: evidenceGate,
  });
}

describe("evidence gate wired into Mission.addFinding", () => {
  test("accepts a finding whose provenance matches a successful observation", () => {
    const m = mission();
    const obs = m.record("observation", "config.ts sets debug=true", { tool: "read_file", ok: true });
    const res = m.addFinding({
      claim: "debug is enabled in config.ts",
      provenance: { toolCall: "read_file", observationSeq: obs.seq },
    });
    expect(res.accepted).toBe(true);
    expect(m.findings).toHaveLength(1);
  });

  test("rejects a fabricated finding with no matching transcript entry", () => {
    const m = mission();
    m.record("observation", "real thing", { tool: "read_file", ok: true });
    const res = m.addFinding({
      claim: "something I never observed",
      provenance: { toolCall: "read_file", observationSeq: 999 },
    });
    expect(res.accepted).toBe(false);
    if (!res.accepted) expect(res.reason).toContain("no transcript entry");
    expect(m.findings).toHaveLength(0);
  });

  test("rejects provenance pointing at a non-observation entry", () => {
    const m = mission();
    const model = m.record("model", "I think debug is on");
    const res = m.addFinding({
      claim: "debug is on",
      provenance: { toolCall: "read_file", observationSeq: model.seq },
    });
    expect(res.accepted).toBe(false);
    if (!res.accepted) expect(res.reason).toContain("not an observation");
  });

  test("rejects a tool-name mismatch between finding and observation", () => {
    const m = mission();
    const obs = m.record("observation", "listing", { tool: "list_dir", ok: true });
    const res = m.addFinding({
      claim: "misattributed",
      provenance: { toolCall: "read_file", observationSeq: obs.seq },
    });
    expect(res.accepted).toBe(false);
    if (!res.accepted) expect(res.reason).toContain("produced by");
  });

  test("rejects a finding backed by a failed/denied observation", () => {
    const m = mission();
    const denied = m.record("observation", "SCOPE DENIED: off scope", { tool: "http_get", ok: false });
    const res = m.addFinding({
      claim: "the denied call proves something",
      provenance: { toolCall: "http_get", observationSeq: denied.seq },
    });
    expect(res.accepted).toBe(false);
    if (!res.accepted) expect(res.reason).toContain("failed/denied");
    expect(m.findings).toHaveLength(0);
  });
});
