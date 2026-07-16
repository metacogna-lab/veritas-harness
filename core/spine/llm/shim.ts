/**
 * Text-mode tool-calling shim.
 *
 * Many models (local llama/qwen, some OpenRouter routes) have no native
 * function-calling. The shim makes them usable through the same interface:
 *
 *   - `buildToolInstructions()` serializes tool schemas into a system-prompt
 *     block describing how to emit a tool call as JSON.
 *   - `parseToolCalls()` extracts the emitted tool call from raw model text,
 *     using the robust parser (never a naive JSON.parse).
 *
 * Contract with the model: to call a tool, emit a single JSON object
 *   { "tool": "<name>", "input": { ... } }
 * as the last JSON object in the reply. To answer, emit
 *   { "final": "<answer text>" }
 */
import { parseLastObject } from "../parse/json.ts";
import type { ToolSchema, ToolCall } from "./types.ts";

export const FINAL_KEY = "final";

export function buildToolInstructions(tools: ToolSchema[]): string {
  if (tools.length === 0) return "";
  const lines: string[] = [
    "You have access to the following tools. To use one, reply with a single JSON",
    'object as the LAST content in your message: {"tool":"<name>","input":{...}}.',
    'When you are done and want to give a final answer, reply with {"final":"<answer>"}.',
    "Emit exactly one such JSON object. Do not wrap it in extra prose after it.",
    "",
    "Tools:",
  ];
  for (const t of tools) {
    lines.push(`- ${t.name}: ${t.description}`);
    lines.push(`  input schema: ${JSON.stringify(t.parameters)}`);
  }
  return lines.join("\n");
}

/**
 * Parse tool calls out of raw model text. Returns the single tool call the
 * model requested (as a one-element array for interface symmetry with native
 * mode), or an empty array if the model emitted a final answer / no tool call.
 */
export function parseToolCalls(text: string): ToolCall[] {
  const obj = parseLastObject(text);
  if (!obj) return [];
  if (FINAL_KEY in obj) return []; // final answer, not a tool call
  const name = obj.tool;
  if (typeof name !== "string") return [];
  const input = obj.input;
  const inputObj =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  return [{ name, input: inputObj }];
}

/**
 * Extract a final answer from shimmed text if present, else undefined.
 * When the model emits {"final": "..."} we surface that string; otherwise the
 * caller treats the whole text as the answer.
 */
export function parseFinalAnswer(text: string): string | undefined {
  const obj = parseLastObject(text);
  if (obj && FINAL_KEY in obj && typeof obj[FINAL_KEY] === "string") {
    return obj[FINAL_KEY] as string;
  }
  return undefined;
}
