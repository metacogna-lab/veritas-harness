/**
 * Robust JSON extraction from raw model output.
 *
 * Model output is untrusted text: it may wrap JSON in ``` fences, precede or
 * follow it with prose, or emit several candidate objects. A naive
 * `JSON.parse` on the whole string fails on all of these. The contract here is:
 *
 *   1. strip code fences,
 *   2. try a direct parse of the whole (trimmed) string,
 *   3. otherwise scan every balanced {...} / [...] span and return the LAST one
 *      that parses to the expected shape.
 *
 * "Last one that parses" matters: models frequently restate their reasoning and
 * then emit the real answer last, so the final valid span is the intended one.
 *
 * INVARIANT: no other module in this codebase calls `JSON.parse` directly on
 * model output. Everything goes through here.
 */

/** Remove ```lang ... ``` and ``` ... ``` fences, returning inner content joined. */
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

/**
 * Find TOP-LEVEL balanced spans that begin with `open` and end with the
 * matching `close`, respecting string literals and escapes so braces inside
 * strings do not corrupt the balance count. Nested spans are not returned
 * separately — once a top-level span closes, scanning resumes after it. This is
 * deliberate: it lets "the last span that parses" mean the last *complete*
 * object/array a model emitted, rather than the innermost nested fragment.
 * Returns spans in source order.
 */
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
    // Resume scanning after a completed top-level span so nested opens inside
    // it are not re-collected as their own spans.
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

/**
 * Parse the LAST JSON object present in `text`, or `undefined` if none parses.
 */
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

/**
 * Parse the LAST JSON array present in `text`, or `undefined` if none parses.
 */
export function parseLastArray(text: string): unknown[] | undefined {
  const cleaned = stripFences(text).trim();

  const direct = tryParse(cleaned);
  if (Array.isArray(direct)) return direct;

  const spans = balancedSpans(cleaned, "[");
  for (let i = spans.length - 1; i >= 0; i--) {
    const parsed = tryParse(spans[i]!);
    if (Array.isArray(parsed)) return parsed;
  }
  return undefined;
}
