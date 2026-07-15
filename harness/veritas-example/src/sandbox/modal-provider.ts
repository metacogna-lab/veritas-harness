/**
 * ModalProvider — Modal TS sandboxes (Phase 3.0 Loop M).
 * Requires MODAL_TOKEN_ID + MODAL_TOKEN_SECRET; tests skip when unset.
 *
 * Note: Uses dynamic import of the `modal` package when present. Without tokens
 * or the package installed, provision throws a clear error (never silent).
 */
import type {
  ArtifactManifest,
  ExecResult,
  ExecSpec,
  SandboxHandle,
  SandboxLogLine,
  SandboxProvider,
  SandboxSpec,
} from "../../../../core/sandbox/types.ts";

export function modalConfigured(): boolean {
  return Boolean(process.env.MODAL_TOKEN_ID && process.env.MODAL_TOKEN_SECRET);
}

export class ModalProvider implements SandboxProvider {
  readonly name = "modal" as const;
  private logs = new Map<string, SandboxLogLine[]>();

  async provision(spec: SandboxSpec): Promise<SandboxHandle> {
    if (!modalConfigured()) {
      throw new Error("modal provider: MODAL_TOKEN_ID/MODAL_TOKEN_SECRET not set");
    }
    // Soft dependency — Modal SDK may not be installed until Loop M ships `bun add modal`.
    try {
      await import("modal");
    } catch {
      throw new Error("modal provider: package `modal` not installed — run `bun add modal`");
    }
    // Skeleton handle until live SDK wiring (Loop M completes against a Modal account).
    return {
      id: spec.runId,
      provider: "modal",
      resourceId: `modal-pending-${spec.runId}`,
      workdir: spec.workdir,
    };
  }

  async execute(h: SandboxHandle, cmd: ExecSpec): Promise<ExecResult> {
    const startedAt = new Date().toISOString();
    const detail = `modal execute not fully wired (resource=${h.resourceId}, cmd=${cmd.command.join(" ")})`;
    this.logs.set(h.id, [{ stream: "stderr", text: detail, at: startedAt }]);
    return { exitCode: 1, stdout: "", stderr: detail, durationMs: 0, startedAt };
  }

  async *getLogs(h: SandboxHandle): AsyncIterable<SandboxLogLine> {
    for (const line of this.logs.get(h.id) ?? []) yield line;
  }

  async teardown(_h: SandboxHandle): Promise<void> {
    /* no-op until live SDK terminate */
  }

  async collectArtifacts(_h: SandboxHandle): Promise<ArtifactManifest> {
    return { files: [] };
  }
}
