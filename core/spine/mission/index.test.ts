import { describe, expect, test } from "bun:test";
import { Mission } from "./index.ts";
import type { MissionScope } from "../safety/scope.ts";

const scope: MissionScope = { hosts: ["example.com"], paths: ["/work"] };

const mkMission = () => {
  let n = 0;
  return new Mission({
    objective: "read the file and summarize",
    scope,
    now: () => "2026-07-09T00:00:00.000Z",
    idGen: () => `id-${n++}`,
  });
};

describe("Mission transcript", () => {
  test("seeds the objective as the first entry", () => {
    const m = mkMission();
    expect(m.entries).toHaveLength(1);
    expect(m.entries[0]!.kind).toBe("objective");
    expect(m.entries[0]!.content).toBe("read the file and summarize");
  });

  test("record appends monotonically-sequenced entries", () => {
    const m = mkMission();
    m.record("model", "thinking");
    m.record("tool_call", "read_file");
    expect(m.entries.map((e) => e.seq)).toEqual([0, 1, 2]);
    expect(m.entries.map((e) => e.kind)).toEqual(["objective", "model", "tool_call"]);
  });

  test("entries are frozen and never mutated after write", () => {
    const m = mkMission();
    const entry = m.record("observation", "file contents");
    expect(Object.isFrozen(entry)).toBe(true);
    // attempting to mutate throws in strict mode (module code is strict)
    expect(() => {
      (entry as { content: string }).content = "tampered";
    }).toThrow();
    expect(m.entries[1]!.content).toBe("file contents");
  });

  test("meta is stored frozen", () => {
    const m = mkMission();
    const entry = m.record("tool_call", "http_get", { url: "https://example.com" });
    expect(entry.meta).toEqual({ url: "https://example.com" });
    expect(Object.isFrozen(entry.meta)).toBe(true);
  });

  test("transcript() formats entries for the model", () => {
    const m = mkMission();
    m.record("model", "let me read it");
    const txt = m.transcript();
    expect(txt).toContain("[0] OBJECTIVE: read the file and summarize");
    expect(txt).toContain("[1] MODEL: let me read it");
  });
});

describe("Mission status", () => {
  test("setStatus updates status and records it", () => {
    const m = mkMission();
    m.setStatus("running");
    expect(m.status).toBe("running");
    expect(m.entries.at(-1)!.kind).toBe("status");
    expect(m.entries.at(-1)!.content).toBe("running");
  });
});

describe("Mission findings", () => {
  test("addFinding appends a proposed finding by default", () => {
    const m = mkMission();
    const obs = m.record("observation", "the file says X");
    const res = m.addFinding({ claim: "the file says X", provenance: { toolCall: "read_file", observationSeq: obs.seq } });
    expect(res.accepted).toBe(true);
    expect(m.findings).toHaveLength(1);
    expect(m.findings[0]!.status).toBe("proposed");
  });

  test("findings are frozen after write", () => {
    const m = mkMission();
    const obs = m.record("observation", "x");
    m.addFinding({ claim: "x", provenance: { toolCall: "read_file", observationSeq: obs.seq } });
    expect(Object.isFrozen(m.findings[0])).toBe(true);
    expect(() => {
      (m.findings[0] as { status: string }).status = "confirmed";
    }).toThrow();
  });

  test("a rejecting validator prevents the finding from entering the array", () => {
    let n = 0;
    const m = new Mission({
      objective: "obj",
      scope,
      now: () => "t",
      idGen: () => `id-${n++}`,
      findingValidator: () => ({ accepted: false, reason: "no provenance" }),
    });
    const res = m.addFinding({ claim: "fabricated", provenance: { toolCall: "none", observationSeq: 99 } });
    expect(res.accepted).toBe(false);
    if (!res.accepted) expect(res.reason).toBe("no provenance");
    expect(m.findings).toHaveLength(0);
  });

  test("updateFindingStatus replaces without mutating the original", () => {
    const m = mkMission();
    const obs = m.record("observation", "x");
    const added = m.addFinding({ claim: "x", provenance: { toolCall: "read_file", observationSeq: obs.seq } });
    if (!added.accepted) throw new Error("expected accept");
    const original = added.finding;
    const updated = m.updateFindingStatus(original.id, "confirmed", "survived refutation");
    expect(updated!.status).toBe("confirmed");
    expect(updated!.refutation).toBe("survived refutation");
    // original object is untouched
    expect(original.status).toBe("proposed");
  });
});

describe("Mission snapshot", () => {
  test("snapshot is frozen and serializable", () => {
    const m = mkMission();
    m.record("model", "hi");
    const snap = m.snapshot();
    expect(Object.isFrozen(snap)).toBe(true);
    expect(() => JSON.stringify(snap)).not.toThrow();
    expect(snap.objective).toBe("read the file and summarize");
    expect(snap.transcript).toHaveLength(2);
  });

  test("mutating a snapshot does not affect later mission records", () => {
    const m = mkMission();
    const snap = m.snapshot();
    m.record("note", "added after snapshot");
    expect(snap.transcript).toHaveLength(1);
    expect(m.entries).toHaveLength(2);
  });
});
