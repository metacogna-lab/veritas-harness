import { describe, expect, test } from "bun:test";
import { LLMBackbone } from "./index.ts";
import { buildToolInstructions, parseToolCalls, parseFinalAnswer } from "./shim.ts";
import type { ProviderConfig } from "../config/index.ts";
import type { Transport, TransportResponse } from "./types.ts";

const cfg = (provider: ProviderConfig["provider"], model = "m"): ProviderConfig => ({
  provider,
  model,
  apiKey: "sk-test-000000000000",
  baseUrl: "http://localhost",
  maxTokens: 100,
  temperature: 0,
});

const zeroUsage = { inputTokens: 0, outputTokens: 0 };

describe("shim", () => {
  test("buildToolInstructions lists each tool", () => {
    const out = buildToolInstructions([
      { name: "read_file", description: "read a file", parameters: { type: "object" } },
    ]);
    expect(out).toContain("read_file");
    expect(out).toContain('{"tool"');
    expect(out).toContain('{"final"');
  });

  test("parseToolCalls extracts a tool call", () => {
    const calls = parseToolCalls('I will read it. {"tool":"read_file","input":{"path":"a.txt"}}');
    expect(calls).toEqual([{ name: "read_file", input: { path: "a.txt" } }]);
  });

  test("parseToolCalls returns empty for a final answer", () => {
    expect(parseToolCalls('{"final":"the answer is 42"}')).toEqual([]);
  });

  test("parseFinalAnswer extracts the final string", () => {
    expect(parseFinalAnswer('{"final":"done"}')).toBe("done");
  });

  test("parseToolCalls defaults missing input to empty object", () => {
    expect(parseToolCalls('{"tool":"list_dir"}')).toEqual([{ name: "list_dir", input: {} }]);
  });
});

describe("LLMBackbone native mode", () => {
  test("returns native tool calls unchanged", async () => {
    const transport: Transport = async (): Promise<TransportResponse> => ({
      text: "",
      nativeToolCalls: [{ name: "http_get", input: { url: "http://x" } }],
      usage: { inputTokens: 5, outputTokens: 2 },
    });
    const llm = new LLMBackbone({ configs: [cfg("anthropic")], transport });
    const res = await llm.complete({ messages: [{ role: "user", content: "hi" }] });
    expect(res.toolCalls).toEqual([{ name: "http_get", input: { url: "http://x" } }]);
    expect(res.usage.inputTokens).toBe(5);
  });
});

describe("LLMBackbone shim mode", () => {
  test("parses tool calls from text for a non-native (local) provider", async () => {
    let sentSystem = "";
    const transport: Transport = async (_c, req): Promise<TransportResponse> => {
      sentSystem = req.system ?? "";
      return { text: '{"tool":"read_file","input":{"path":"a"}}', usage: zeroUsage };
    };
    const llm = new LLMBackbone({ configs: [cfg("local")], transport });
    const res = await llm.complete({
      messages: [{ role: "user", content: "read a" }],
      tools: [{ name: "read_file", description: "read", parameters: { type: "object" } }],
    });
    expect(res.toolCalls).toEqual([{ name: "read_file", input: { path: "a" } }]);
    // shim folded tool instructions into the system prompt
    expect(sentSystem).toContain("read_file");
  });

  test("surfaces a shimmed final answer as text", async () => {
    const transport: Transport = async (): Promise<TransportResponse> => ({
      text: 'Reasoning... {"final":"the sky is blue"}',
      usage: zeroUsage,
    });
    const llm = new LLMBackbone({ configs: [cfg("local")], transport });
    const res = await llm.complete({ messages: [{ role: "user", content: "?" }] });
    expect(res.text).toBe("the sky is blue");
    expect(res.toolCalls).toEqual([]);
  });
});

describe("LLMBackbone retry + fallback", () => {
  test("retries a transient failure then succeeds", async () => {
    let calls = 0;
    const transport: Transport = async (): Promise<TransportResponse> => {
      calls++;
      if (calls < 2) throw new Error("transient 503");
      return { text: "ok", usage: zeroUsage };
    };
    const llm = new LLMBackbone({
      configs: [cfg("anthropic")],
      transport,
      backoffBaseMs: 1,
      sleep: async () => {},
    });
    const res = await llm.complete({ messages: [{ role: "user", content: "hi" }] });
    expect(res.text).toBe("ok");
    expect(calls).toBe(2);
  });

  test("falls back to the second config when the first exhausts retries", async () => {
    const transport: Transport = async (c): Promise<TransportResponse> => {
      if (c.provider === "anthropic") throw new Error("down");
      return { text: "from-openai", usage: zeroUsage };
    };
    const llm = new LLMBackbone({
      configs: [cfg("anthropic"), cfg("openai")],
      transport,
      maxRetries: 1,
      backoffBaseMs: 1,
      sleep: async () => {},
    });
    const res = await llm.complete({ messages: [{ role: "user", content: "hi" }] });
    expect(res.text).toBe("from-openai");
  });

  test("throws an aggregated error when all providers fail", async () => {
    const transport: Transport = async (): Promise<TransportResponse> => {
      throw new Error("boom");
    };
    const llm = new LLMBackbone({
      configs: [cfg("anthropic"), cfg("openai")],
      transport,
      maxRetries: 0,
      sleep: async () => {},
    });
    await expect(llm.complete({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      "All providers failed",
    );
  });
});
