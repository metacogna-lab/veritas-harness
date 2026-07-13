/**
 * Server-side research plan compiler — Anthropic (Node) adapter over the shared,
 * runtime-agnostic compiler in ./ingest-contract (veritas-v0.2 C-2).
 *
 * This file owns only the Anthropic-SDK wiring; the prompt, template, and
 * retry/validate loop are the single source of truth in ./ingest-contract, shared
 * with the harness's Bun/LLMBackbone path via a vendored copy + drift-guard test.
 */
import Anthropic from "@anthropic-ai/sdk";
import { compileBrief, type LlmCall } from "./ingest-contract";
import type { MissionPayload } from "./types";
import type { ResearchPlan } from "./schema";

/** Build an LlmCall backed by the Anthropic Messages API. */
function anthropicCaller(): LlmCall {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.VERITAS_MODEL ?? "claude-sonnet-4-6";

  return async (system, user) => {
    const message = await client.messages.create({
      model,
      max_tokens: 4096,
      temperature: 0,
      system,
      messages: [{ role: "user", content: user }],
    });
    return message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");
  };
}

export async function serverCompileBrief(payload: MissionPayload): Promise<ResearchPlan> {
  return compileBrief(payload, anthropicCaller());
}
