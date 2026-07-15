/**
 * LocalProvider — in-process / host subprocess sandbox (DEFAULT).
 * Executes commands on the current machine; default for SANDBOX_PROVIDER=local.
 */
import { spawn } from "node:child_process";
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

export class LocalProvider implements SandboxProvider {
  readonly name = "local" as const;
  private logs = new Map<string, SandboxLogLine[]>();

  async provision(spec: SandboxSpec): Promise<SandboxHandle> {
    return {
      id: spec.runId,
      provider: "local",
      resourceId: `local-${spec.runId}`,
      workdir: spec.workdir,
    };
  }

  async execute(h: SandboxHandle, cmd: ExecSpec): Promise<ExecResult> {
    const startedAt = new Date().toISOString();
    const t0 = Date.now();
    const cwd = cmd.cwd ?? h.workdir;
    const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
      const child = spawn(cmd.command[0]!, cmd.command.slice(1), {
        cwd,
        env: { ...process.env, ...cmd.env },
        shell: false,
      });
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (d) => {
        const text = String(d);
        stdout += text;
        this.appendLog(h.id, "stdout", text);
      });
      child.stderr?.on("data", (d) => {
        const text = String(d);
        stderr += text;
        this.appendLog(h.id, "stderr", text);
      });
      child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
      child.on("error", (err) => resolve({ code: 1, stdout: "", stderr: String(err) }));
    });
    return {
      exitCode: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: Date.now() - t0,
      startedAt,
    };
  }

  async *getLogs(h: SandboxHandle): AsyncIterable<SandboxLogLine> {
    for (const line of this.logs.get(h.id) ?? []) yield line;
  }

  async teardown(_h: SandboxHandle): Promise<void> {
    /* no-op for local */
  }

  async collectArtifacts(h: SandboxHandle): Promise<ArtifactManifest> {
    const files: ArtifactManifest["files"] = [];
    if (!existsSync(h.workdir)) return { files };
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) walk(p);
        else {
          const sha256 = createHash("sha256").update(readFileSync(p)).digest("hex");
          files.push({ path: p, sha256 });
        }
      }
    };
    walk(h.workdir);
    return { files };
  }

  private appendLog(id: string, stream: "stdout" | "stderr", text: string): void {
    const list = this.logs.get(id) ?? [];
    list.push({ stream, text, at: new Date().toISOString() });
    this.logs.set(id, list);
  }
}
