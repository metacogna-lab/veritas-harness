/**
 * Real HTTP transports. Production paths — never exercised in tests (tests
 * inject a fake transport). Two HTTP shapes cover API providers:
 *   - anthropic: Messages API
 *   - openai-compatible: OpenAI Chat Completions (openai, openrouter, ollama)
 *
 * CLI providers (claude-code, codex) route to cli-transport.ts.
 */
import type { ProviderConfig } from "../config/index.ts";
import type { CompletionRequest, Transport, TransportResponse, ToolCall } from "./types.ts";
import { cliTransport, isCliProvider } from "./cli-transport.ts";

interface AnthropicContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface AnthropicResponse {
  content: AnthropicContentBlock[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

interface OpenAIToolCall {
  function?: { name?: string; arguments?: unknown };
}

interface OpenAIChoice {
  message?: { content?: string | null; tool_calls?: OpenAIToolCall[] };
}

interface OpenAIResponse {
  choices?: OpenAIChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function requireKey(cfg: ProviderConfig): string {
  if (!cfg.apiKey) {
    throw new Error(
      `No API key resolved for provider "${cfg.provider}". Set the provider's key env var.`,
    );
  }
  return cfg.apiKey;
}

const anthropicTransport: Transport = async (cfg, req, signal): Promise<TransportResponse> => {
  const key = requireKey(cfg);
  const body: Record<string, unknown> = {
    model: cfg.model,
    max_tokens: req.maxTokens ?? cfg.maxTokens,
    temperature: req.temperature ?? cfg.temperature,
    system: req.system,
    messages: req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
  };
  if (req.tools && req.tools.length > 0) {
    body.tools = req.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }
  const res = await fetch(`${cfg.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`anthropic HTTP ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as AnthropicResponse;
  if (!Array.isArray(json.content)) {
    throw new Error(`anthropic: unexpected response shape — content is not an array: ${JSON.stringify(json).slice(0, 200)}`);
  }
  let text = "";
  const toolCalls: ToolCall[] = [];
  for (const block of json.content) {
    if (block.type === "text") text += block.text ?? "";
    else if (block.type === "tool_use") toolCalls.push({ name: block.name ?? "", input: block.input ?? {} });
  }
  return {
    text,
    nativeToolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    usage: {
      inputTokens: json.usage?.input_tokens ?? 0,
      outputTokens: json.usage?.output_tokens ?? 0,
    },
  };
};

const openaiCompatibleTransport: Transport = async (cfg, req, signal): Promise<TransportResponse> => {
  const key = cfg.provider === "ollama" ? (cfg.apiKey ?? "not-needed") : requireKey(cfg);
  const messages = [
    ...(req.system ? [{ role: "system", content: req.system }] : []),
    ...req.messages.map((m) => ({
      role: m.role === "tool" ? "user" : m.role,
      content: m.content,
    })),
  ];
  const body: Record<string, unknown> = {
    model: cfg.model,
    max_tokens: req.maxTokens ?? cfg.maxTokens,
    temperature: req.temperature ?? cfg.temperature,
    messages,
  };
  if (req.tools && req.tools.length > 0) {
    body.tools = req.tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`${cfg.provider} HTTP ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as OpenAIResponse;
  const message = json.choices?.[0]?.message ?? {};
  const toolCalls: ToolCall[] = (message.tool_calls ?? []).map((tc) => ({
    name: tc.function?.name ?? "",
    input: safeArgs(tc.function?.arguments),
  }));
  return {
    text: message.content ?? "",
    nativeToolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    usage: {
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
    },
  };
};

function safeArgs(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/** Select the real transport for a provider. */
export function defaultTransport(cfg: ProviderConfig): Transport {
  if (isCliProvider(cfg.provider)) return cliTransport(cfg);
  return cfg.provider === "anthropic" ? anthropicTransport : openaiCompatibleTransport;
}
