/**
 * LLMBackbone — the single normalized entry point to any model.
 *
 * Responsibilities:
 *   - `complete()` runs one logical completion, trying each config in the
 *     fallback chain in order until one succeeds.
 *   - Retry with exponential backoff around transient transport failures.
 *   - Apply the text-mode tool-calling shim for providers/configs that are not
 *     in native function-calling mode, so callers see a uniform
 *     `{ text, toolCalls, usage }` regardless of provider.
 *   - Never log secrets (this module logs nothing; callers redact()).
 *
 * The transport is injected (default: real HTTP). Tests pass a fake transport,
 * so no test performs a real network call.
 */
import type { ProviderConfig } from "../config/index.ts";
import type { CompletionRequest, CompletionResult, Transport } from "./types.ts";
import { defaultTransport } from "./transports.ts";
import { buildToolInstructions, parseToolCalls, parseFinalAnswer } from "./shim.ts";

export * from "./types.ts";
export { buildToolInstructions, parseToolCalls, parseFinalAnswer } from "./shim.ts";

export interface LLMBackboneOptions {
  /** Primary config plus ordered fallbacks; tried left to right. */
  configs: ProviderConfig[];
  /** Injected transport (default: real HTTP). Tests pass a fake. */
  transport?: Transport;
  /** Whether the primary config uses native function-calling (default true for
   *  anthropic/openai, false otherwise). When false, the shim is used. */
  nativeToolCalling?: (cfg: ProviderConfig) => boolean;
  maxRetries?: number;
  /** Base backoff in ms (grows exponentially). Small in tests. */
  backoffBaseMs?: number;
  /** Injected sleeper so tests don't actually wait. */
  sleep?: (ms: number) => Promise<void>;
}

import { getProviderDef } from "../config/providers.ts";

const defaultNative = (cfg: ProviderConfig): boolean => getProviderDef(cfg.provider).nativeToolCalling;

const realSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export class LLMBackbone {
  private readonly configs: ProviderConfig[];
  private readonly transport: Transport;
  private readonly isNative: (cfg: ProviderConfig) => boolean;
  private readonly maxRetries: number;
  private readonly backoffBaseMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(opts: LLMBackboneOptions) {
    if (opts.configs.length === 0) throw new Error("LLMBackbone requires at least one config");
    this.configs = opts.configs;
    this.transport = opts.transport ?? ((cfg, req, signal) => defaultTransport(cfg)(cfg, req, signal));
    this.isNative = opts.nativeToolCalling ?? defaultNative;
    this.maxRetries = opts.maxRetries ?? 2;
    this.backoffBaseMs = opts.backoffBaseMs ?? 250;
    this.sleep = opts.sleep ?? realSleep;
  }

  /** Run one completion across the fallback chain. */
  async complete(request: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult> {
    const errors: string[] = [];
    for (const cfg of this.configs) {
      try {
        return await this.completeWithRetry(cfg, request, signal);
      } catch (err) {
        errors.push(`${cfg.provider}/${cfg.model}: ${(err as Error).message}`);
      }
    }
    throw new Error(`All providers failed. ${errors.join(" | ")}`);
  }

  private async completeWithRetry(
    cfg: ProviderConfig,
    request: CompletionRequest,
    signal?: AbortSignal,
  ): Promise<CompletionResult> {
    const native = this.isNative(cfg);
    const effectiveRequest = native ? request : this.shimRequest(request);

    let lastErr: Error | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const raw = await this.transport(cfg, effectiveRequest, signal);
        return this.normalize(raw, native);
      } catch (err) {
        lastErr = err as Error;
        if (attempt < this.maxRetries) {
          await this.sleep(this.backoffBaseMs * 2 ** attempt);
        }
      }
    }
    throw lastErr ?? new Error("completion failed with no error captured");
  }

  /** Fold tool schemas into the system prompt for non-native models. */
  private shimRequest(request: CompletionRequest): CompletionRequest {
    if (!request.tools || request.tools.length === 0) return request;
    const instructions = buildToolInstructions(request.tools);
    const system = request.system ? `${request.system}\n\n${instructions}` : instructions;
    // Strip `tools` so the transport doesn't also send them natively.
    return { ...request, system, tools: undefined };
  }

  private normalize(
    raw: { text: string; nativeToolCalls?: CompletionResult["toolCalls"]; usage: CompletionResult["usage"] },
    native: boolean,
  ): CompletionResult {
    if (native) {
      return { text: raw.text, toolCalls: raw.nativeToolCalls ?? [], usage: raw.usage };
    }
    // Shim mode: parse tool calls / final answer out of the text.
    const toolCalls = parseToolCalls(raw.text);
    const finalAnswer = parseFinalAnswer(raw.text);
    return {
      text: finalAnswer ?? raw.text,
      toolCalls,
      usage: raw.usage,
    };
  }
}
