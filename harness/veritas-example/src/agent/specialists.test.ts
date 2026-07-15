import { describe, expect, test } from "bun:test";
import { LoadoutRegistry } from "./specialists.ts";
import type { Loadout } from "./specialists.ts";

const fakeLoadout: Loadout = {
  name: "fake",
  description: "a test loadout",
  toolNames: ["read_file"],
  specialists: [{ role: "worker", systemPrompt: "do the thing", toolAllowlist: ["read_file"] }],
  targetAdapter: {
    name: "fs",
    buildScope: (target) => ({ hosts: [], paths: [target] }),
    describeScope: (scope) => `paths: ${scope.paths.join(", ")}`,
  },
};

describe("LoadoutRegistry", () => {
  test("registers and retrieves a loadout", () => {
    const reg = new LoadoutRegistry().register(fakeLoadout);
    expect(reg.has("fake")).toBe(true);
    expect(reg.get("fake")?.description).toBe("a test loadout");
    expect(reg.list()).toHaveLength(1);
  });

  test("duplicate registration throws", () => {
    const reg = new LoadoutRegistry().register(fakeLoadout);
    expect(() => reg.register(fakeLoadout)).toThrow("already registered");
  });

  test("rejects specialist allowlisting a tool the loadout does not expose", () => {
    const reg = new LoadoutRegistry();
    expect(() =>
      reg.register({
        ...fakeLoadout,
        name: "bad",
        specialists: [{ role: "x", systemPrompt: "p", toolAllowlist: ["http_get"] }],
      }),
    ).toThrow("does not expose");
  });

  test("selectSpecialist returns the named role", () => {
    const reg = new LoadoutRegistry().register(fakeLoadout);
    const specialist = reg.selectSpecialist("fake", "worker");
    expect(specialist?.role).toBe("worker");
  });

  test("selectSpecialist falls back to first specialist when role is omitted", () => {
    const reg = new LoadoutRegistry().register(fakeLoadout);
    const specialist = reg.selectSpecialist("fake", undefined);
    expect(specialist?.role).toBe("worker");
  });

  test("empty registry has no loadouts", () => {
    const reg = new LoadoutRegistry();
    expect(reg.list()).toHaveLength(0);
  });
});
