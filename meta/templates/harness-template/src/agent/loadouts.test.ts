/**
 * LoadoutRegistry registration from HarnessSpec codegen (H-4).
 */
import { test, expect } from "bun:test";
import { defaultLoadouts } from "./loadouts.ts";
import { generatedLoadouts } from "./loadouts.generated.ts";
import { fromGeneratedLoadout, LoadoutRegistry } from "./specialists.ts";

test("defaultLoadouts registers every generatedLoadouts entry", () => {
  const reg = defaultLoadouts();
  expect(reg.list()).toHaveLength(generatedLoadouts.length);
  for (const g of generatedLoadouts) {
    expect(reg.has(g.name)).toBe(true);
    expect(reg.get(g.name)!.toolNames).toEqual(g.toolNames);
  }
});

test("fromGeneratedLoadout builds a registerable Loadout", () => {
  const loadout = fromGeneratedLoadout({
    name: "research",
    adapter: "path",
    toolNames: ["read_file"],
    specialists: [{ role: "researcher", focus: "explore" }],
  });
  const reg = new LoadoutRegistry().register(loadout);
  expect(reg.get("research")!.specialists[0]!.toolAllowlist).toContain("read_file");
  expect(reg.get("research")!.targetAdapter.name).toBe("path");
});
