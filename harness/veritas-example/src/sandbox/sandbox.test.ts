import { describe, test, expect } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalProvider } from "./local-provider.ts";
import { DockerProvider, dockerAvailable } from "./docker-provider.ts";
import { ModalProvider, modalConfigured } from "./modal-provider.ts";
import { selectProvider } from "./select.ts";

describe("SandboxProvider select", () => {
  test("defaults to local", () => {
    const prev = process.env.SANDBOX_PROVIDER;
    delete process.env.SANDBOX_PROVIDER;
    expect(selectProvider().name).toBe("local");
    if (prev !== undefined) process.env.SANDBOX_PROVIDER = prev;
  });

  test("routes docker and modal by name", () => {
    expect(selectProvider("docker").name).toBe("docker");
    expect(selectProvider("modal").name).toBe("modal");
  });
});

describe("LocalProvider", () => {
  test("provision → execute echo → teardown", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sbx-local-"));
    try {
      writeFileSync(join(dir, "note.txt"), "hi");
      const p = new LocalProvider();
      const h = await p.provision({ runId: "r1", workdir: dir });
      const res = await p.execute(h, { command: ["bun", "-e", "console.log(1+1)"] });
      expect(res.exitCode).toBe(0);
      expect(res.stdout.trim()).toBe("2");
      const arts = await p.collectArtifacts(h);
      expect(arts.files.some((f) => f.path.endsWith("note.txt"))).toBe(true);
      await p.teardown(h);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("DockerProvider", () => {
  test("skipped or provisions when docker available", async () => {
    if (!dockerAvailable()) {
      expect(dockerAvailable()).toBe(false);
      return;
    }
    const p = new DockerProvider();
    // Prefer alpine for smoke if veritas image missing — use hello-world style echo via alpine
    const dir = mkdtempSync(join(tmpdir(), "sbx-docker-"));
    try {
      const h = await p.provision({
        runId: `d${Date.now()}`,
        workdir: dir,
        image: "alpine:3.20",
        timeoutSeconds: 30,
      });
      const res = await p.execute(h, { command: ["echo", "ok"] });
      expect(res.exitCode).toBe(0);
      expect(res.stdout).toContain("ok");
      await p.teardown(h);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});

describe("ModalProvider", () => {
  test("throws without tokens", async () => {
    const prevId = process.env.MODAL_TOKEN_ID;
    const prevSecret = process.env.MODAL_TOKEN_SECRET;
    delete process.env.MODAL_TOKEN_ID;
    delete process.env.MODAL_TOKEN_SECRET;
    try {
      const p = new ModalProvider();
      await expect(p.provision({ runId: "m1", workdir: "/tmp" })).rejects.toThrow(/MODAL_TOKEN/);
      expect(modalConfigured()).toBe(false);
    } finally {
      if (prevId) process.env.MODAL_TOKEN_ID = prevId;
      if (prevSecret) process.env.MODAL_TOKEN_SECRET = prevSecret;
    }
  });
});
