/**
 * DockerProvider — container-per-run using the existing harness image.
 * Skips cleanly when `docker` is unavailable (tests guard with dockerAvailable()).
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type {
  ArtifactManifest,
  ExecResult,
  ExecSpec,
  SandboxHandle,
  SandboxLogLine,
  SandboxProvider,
  SandboxSpec,
} from "../../../../core/sandbox/types.ts";

const DEFAULT_IMAGE = process.env.VERITAS_DOCKER_IMAGE ?? "veritas-example:local";

export function dockerAvailable(): boolean {
  const res = spawnSync("docker", ["info"], { encoding: "utf8" });
  return res.status === 0;
}

export class DockerProvider implements SandboxProvider {
  readonly name = "docker" as const;
  private logs = new Map<string, SandboxLogLine[]>();

  async provision(spec: SandboxSpec): Promise<SandboxHandle> {
    if (!dockerAvailable()) throw new Error("docker provider: docker daemon not available");
    const image = spec.image ?? DEFAULT_IMAGE;
    const args = [
      "run",
      "-d",
      "--name",
      `veritas-${spec.runId}`,
      "-v",
      `${spec.workdir}:/workspace`,
      "-w",
      "/workspace",
    ];
    for (const [k, v] of Object.entries(spec.env ?? {})) {
      args.push("-e", `${k}=${v}`);
    }
    args.push(image, "sleep", String(spec.timeoutSeconds ?? 3600));
    const res = spawnSync("docker", args, { encoding: "utf8" });
    if (res.status !== 0) {
      throw new Error(`docker provision failed: ${res.stderr || res.stdout}`);
    }
    const resourceId = (res.stdout ?? "").trim();
    return {
      id: spec.runId,
      provider: "docker",
      resourceId,
      workdir: "/workspace",
    };
  }

  async execute(h: SandboxHandle, cmd: ExecSpec): Promise<ExecResult> {
    const startedAt = new Date().toISOString();
    const t0 = Date.now();
    const args = ["exec", "-w", cmd.cwd ?? h.workdir];
    for (const [k, v] of Object.entries(cmd.env ?? {})) args.push("-e", `${k}=${v}`);
    args.push(h.resourceId, ...cmd.command);
    const res = spawnSync("docker", args, { encoding: "utf8" });
    const stdout = res.stdout ?? "";
    const stderr = res.stderr ?? "";
    this.logs.set(h.id, [
      ...(this.logs.get(h.id) ?? []),
      { stream: "stdout", text: stdout, at: startedAt },
      { stream: "stderr", text: stderr, at: startedAt },
    ]);
    return {
      exitCode: res.status ?? 1,
      stdout,
      stderr,
      durationMs: Date.now() - t0,
      startedAt,
    };
  }

  async *getLogs(h: SandboxHandle): AsyncIterable<SandboxLogLine> {
    for (const line of this.logs.get(h.id) ?? []) yield line;
  }

  async teardown(h: SandboxHandle): Promise<void> {
    spawnSync("docker", ["rm", "-f", h.resourceId], { encoding: "utf8" });
  }

  async collectArtifacts(h: SandboxHandle): Promise<ArtifactManifest> {
    // Host-side: workdir was bind-mounted; read from the host path stored in handle id mapping is not kept —
    // callers should pass the host workdir via a local companion. Collect empty if missing.
    void h;
    return { files: [] };
  }
}

/** Collect artifacts from a host path (bind-mount root). */
export function collectHostArtifacts(hostWorkdir: string): ArtifactManifest {
  const files: ArtifactManifest["files"] = [];
  if (!existsSync(hostWorkdir)) return { files };
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else files.push({ path: p, sha256: createHash("sha256").update(readFileSync(p)).digest("hex") });
    }
  };
  walk(hostWorkdir);
  return { files };
}
