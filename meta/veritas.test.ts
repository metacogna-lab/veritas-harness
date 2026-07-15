/**
 * Unit tests for the root `veritas` launcher (harness selection + argv peeling).
 */
import { test, expect, describe } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  peelHarnessFlag,
  resolveHarness,
  harnessCliPath,
  launchVeritas,
  repoRoot,
} from "./veritas.ts";
import { emptyRegistry, addHarness, type Registry } from "./registry.ts";

function registryWith(...entries: Parameters<typeof addHarness>[1][]): Registry {
  return entries.reduce((reg, e) => addHarness(reg, e), emptyRegistry());
}

const base = {
  path: "harness/x",
  capabilities: [] as string[],
  planes: [
    "provider",
    "safety",
    "verification",
    "memory",
    "capability",
    "execution",
    "orchestration",
    "control",
  ] as const,
  createdAt: "2026-07-15",
  status: "active" as const,
};

describe("peelHarnessFlag", () => {
  test("strips --harness <name> and leaves the rest", () => {
    expect(peelHarnessFlag(["--harness", "veritas-example", "loadouts"])).toEqual({
      harness: "veritas-example",
      rest: ["loadouts"],
    });
  });

  test("strips --harness=name", () => {
    expect(peelHarnessFlag(["--harness=veritas-research", "status", "abc"])).toEqual({
      harness: "veritas-research",
      rest: ["status", "abc"],
    });
  });

  test("leaves argv unchanged when no harness flag", () => {
    expect(peelHarnessFlag(["start", "obj", "--target", "."])).toEqual({
      harness: undefined,
      rest: ["start", "obj", "--target", "."],
    });
  });
});

describe("resolveHarness", () => {
  test("prefers explicit name", () => {
    const reg = registryWith(
      { ...base, name: "veritas-research", index: 1, path: "harness/veritas-research" },
      {
        ...base,
        name: "veritas-example",
        index: 2,
        path: "harness/veritas-example",
        capabilities: ["research"],
      },
    );
    expect(resolveHarness(reg, { name: "veritas-research" }).name).toBe("veritas-research");
  });

  test("defaults to research-capable harness", () => {
    const reg = registryWith(
      { ...base, name: "veritas-research", index: 1, path: "harness/veritas-research" },
      {
        ...base,
        name: "veritas-example",
        index: 2,
        path: "harness/veritas-example",
        capabilities: ["research"],
      },
    );
    expect(resolveHarness(reg).name).toBe("veritas-example");
  });

  test("falls back to first active by index", () => {
    const reg = registryWith(
      { ...base, name: "alpha", index: 1, path: "harness/alpha" },
      { ...base, name: "beta", index: 2, path: "harness/beta" },
    );
    expect(resolveHarness(reg).name).toBe("alpha");
  });

  test("rejects unknown and archived names", () => {
    const reg = registryWith(
      { ...base, name: "live", index: 1, path: "harness/live" },
      { ...base, name: "dead", index: 2, path: "harness/dead", status: "archived" },
    );
    expect(() => resolveHarness(reg, { name: "nope" })).toThrow(/not registered/);
    expect(() => resolveHarness(reg, { name: "dead" })).toThrow(/archived/);
  });
});

describe("launchVeritas", () => {
  test("spawns the resolved harness CLI with forwarded argv", async () => {
    const root = mkdtempSync(join(tmpdir(), "veritas-cli-"));
    try {
      writeFileSync(
        join(root, "harnesses.json"),
        JSON.stringify({
          version: 1,
          harnesses: [
            {
              name: "veritas-example",
              index: 1,
              path: "harness/veritas-example",
              capabilities: ["research"],
              planes: [...base.planes],
              createdAt: "2026-07-15",
              status: "active",
            },
          ],
        }),
      );
      const cliDir = join(root, "harness/veritas-example/src");
      mkdirSync(cliDir, { recursive: true });
      writeFileSync(join(cliDir, "cli.ts"), "// stub\n");

      const calls: { path: string; args: string[]; cwd: string }[] = [];
      const result = await launchVeritas({
        root,
        argv: ["--harness", "veritas-example", "loadouts", "--verbose"],
        spawn: async (path, args, cwd) => {
          calls.push({ path, args, cwd });
          return 0;
        },
      });

      expect(result.code).toBe(0);
      expect(result.harness.name).toBe("veritas-example");
      expect(calls).toEqual([
        {
          path: join(root, "harness/veritas-example/src/cli.ts"),
          args: ["loadouts", "--verbose"],
          cwd: root,
        },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

test("repoRoot points at the meta parent", () => {
  expect(repoRoot()).toBe(join(import.meta.dir, ".."));
});

test("harnessCliPath joins path/src/cli.ts", () => {
  expect(harnessCliPath("/r", { ...base, name: "h", index: 1, path: "harness/h" })).toBe(
    join("/r", "harness/h/src/cli.ts"),
  );
});
