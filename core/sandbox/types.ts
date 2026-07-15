/**
 * Shared SandboxProvider contract (Phase 3.0 Execution Plane).
 * Provider-agnostic — Local / Docker / Modal all conform.
 */
export type SandboxProviderName = "local" | "docker" | "modal";

export interface SandboxSpec {
  /** Logical run id (mission or goal id). */
  runId: string;
  /** Working directory / mount root inside the sandbox. */
  workdir: string;
  /** Optional image reference (docker/modal). */
  image?: string;
  /** Env vars injected at provision time. */
  env?: Record<string, string>;
  /** Hard timeout seconds (default 3600). */
  timeoutSeconds?: number;
}

export interface SandboxHandle {
  id: string;
  provider: SandboxProviderName;
  /** Provider-specific opaque resource (container id, sandbox id, ...). */
  resourceId: string;
  workdir: string;
}

export interface ExecSpec {
  command: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  startedAt: string;
}

export interface ArtifactFile {
  path: string;
  sha256?: string;
}

export interface ArtifactManifest {
  files: ArtifactFile[];
}

/** Normalized log line mapped toward HarnessEvent consumers. */
export interface SandboxLogLine {
  stream: "stdout" | "stderr";
  text: string;
  at: string;
}

export interface SandboxProvider {
  readonly name: SandboxProviderName;
  provision(spec: SandboxSpec): Promise<SandboxHandle>;
  execute(h: SandboxHandle, cmd: ExecSpec): Promise<ExecResult>;
  getLogs(h: SandboxHandle): AsyncIterable<SandboxLogLine>;
  teardown(h: SandboxHandle): Promise<void>;
  collectArtifacts(h: SandboxHandle): Promise<ArtifactManifest>;
}
