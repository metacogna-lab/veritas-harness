/**
 * CLI subprocess transports for Claude Code and Codex.
 * HTTP providers are handled in transports.ts.
 */
import { spawn } from "node:child_process";
import type { ProviderConfig } from "../config/index.ts";
import type { CompletionRequest, Transport, TransportResponse } from "./types.ts";

function formatPrompt(req: CompletionRequest): string {
  const parts: string[] = [];
  if (req.system) parts.push(`System:\n${req.system}`);
  for (const m of req.messages) {
    parts.push(`${m.role}:\n${m.content}`);
  }
  return parts.join("\n\n");
}

function runCommand(
  binary: string,
  args: string[],
  signal?: AbortSignal,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CLAUDECODE: "" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    const onAbort = () => child.kill("SIGTERM");
    signal?.addEventListener("abort", onAbort);
    child.on("error", (err) => {
      signal?.removeEventListener("abort", onAbort);
      reject(err);
    });
    child.on("close", (code) => {
      signal?.removeEventListener("abort", onAbort);
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}

function parseClaudeJson(stdout: string): string {
  try {
    const parsed = JSON.parse(stdout) as { result?: string; text?: string; is_error?: boolean };
    if (parsed.is_error) throw new Error(parsed.result ?? "claude-code returned is_error");
    return parsed.result ?? parsed.text ?? stdout;
  } catch {
    return stdout.trim();
  }
}

/** Build argv for `claude -p` non-interactive mode. */
function claudeCodeArgs(cfg: ProviderConfig, prompt: string, req: CompletionRequest): string[] {
  const args = ["-p", "--output-format", "json", "--model", cfg.model];
  if (req.system) args.push("--system-prompt", req.system);
  args.push(prompt);
  return args;
}

/** Build argv for `codex exec` non-interactive mode. */
function codexArgs(prompt: string): string[] {
  return ["exec", "--sandbox", "read-only", prompt];
}

/** Select CLI transport for subprocess-backed providers. */
export function cliTransport(cfg: ProviderConfig): Transport {
  return async (_cfg, req, signal): Promise<TransportResponse> => {
    const prompt = formatPrompt(req);
    let binary: string;
    let args: string[];

    if (cfg.provider === "claude-code") {
      binary = "claude";
      args = claudeCodeArgs(cfg, prompt, req);
    } else if (cfg.provider === "codex") {
      binary = "codex";
      args = codexArgs(prompt);
    } else {
      throw new Error(`no CLI transport for provider "${cfg.provider}"`);
    }

    const { stdout, stderr, code } = await runCommand(binary, args, signal);
    if (code !== 0) {
      throw new Error(
        `${cfg.provider} exited ${code}: ${stderr.trim() || stdout.trim() || "no output"}`,
      );
    }

    const text = cfg.provider === "claude-code" ? parseClaudeJson(stdout) : stdout.trim();
    return { text, usage: { inputTokens: 0, outputTokens: 0 } };
  };
}

export function isCliProvider(provider: ProviderConfig["provider"]): boolean {
  return provider === "claude-code" || provider === "codex";
}
