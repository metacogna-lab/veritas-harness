/**
 * Parse plane — robust JSON extraction from untrusted model output.
 *
 * Model output may wrap JSON in ``` fences, surround it with prose, or emit
 * several candidates. Contract: strip fences → try a direct parse → otherwise
 * scan balanced spans and return the LAST one that parses. "Last that parses"
 * matters: models restate reasoning then emit the real answer last.
 *
 * INVARIANT: no other module calls JSON.parse directly on model output.
 */

function stripFences(text: string): string {
  const fence = /```(?:[a-zA-Z0-9_-]+)?\s*\n?([\s\S]*?)```/g;
  const parts: string[] = [];
  let match: RegExpExecArray | null;
  let sawFence = false;
  while ((match = fence.exec(text)) !== null) {
    sawFence = true;
    if (match[1] !== undefined) parts.push(match[1]);
  }
  return sawFence ? parts.join("\n") : text;
}

function balancedSpans(text: string, open: "{" | "["): string[] {
  const close = open === "{" ? "}" : "]";
  const spans: string[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== open) continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    let closedAt = -1;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        if (inString) escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) {
          spans.push(text.slice(i, j + 1));
          closedAt = j;
          break;
        }
      }
    }
    if (closedAt >= 0) i = closedAt;
  }
  return spans;
}

function tryParse(candidate: string): unknown {
  try {
    return JSON.parse(candidate);
  } catch {
    return undefined;
  }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function parseLastObject(text: string): Record<string, unknown> | undefined {
  const cleaned = stripFences(text).trim();
  const direct = tryParse(cleaned);
  if (isObject(direct)) return direct;
  const spans = balancedSpans(cleaned, "{");
  for (let i = spans.length - 1; i >= 0; i--) {
    const parsed = tryParse(spans[i]!);
    if (isObject(parsed)) return parsed;
  }
  return undefined;
}
