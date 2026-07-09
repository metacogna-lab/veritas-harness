/**
 * Sanitize untrusted ingest input — strips homoglyphs/zero-width chars and blocks injection.
 */

const ZERO_WIDTH_RE = /[\u200B-\u200F\uFEFF]/g;

/** Patterns that attempt to override agent operating rules. */
const INJECTION_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "ignore previous instructions", re: /ignore\s+(all\s+)?previous\s+instructions/i },
  { name: "you are now", re: /\byou\s+are\s+now\b/i },
  { name: "system prompt override", re: /system\s*prompt\s*:/i },
  { name: "disregard safety", re: /disregard\s+(all\s+)?safety/i },
];

export interface SanitizeResult {
  text: string;
  blocked: boolean;
  pattern?: string;
}

/** Normalize unicode and strip zero-width characters from ingest text. */
export function normalizeText(text: string): string {
  return text.normalize("NFKC").replace(ZERO_WIDTH_RE, "");
}

/** Scan for prompt-injection patterns; returns block reason when matched. */
export function detectInjection(text: string): string | undefined {
  for (const { name, re } of INJECTION_PATTERNS) {
    if (re.test(text)) return name;
  }
  return undefined;
}

/** Sanitize NEW.md body; blocks on injection patterns per risk-register checklist. */
export function sanitizeIngestText(text: string): SanitizeResult {
  const normalized = normalizeText(text);
  const pattern = detectInjection(normalized);
  if (pattern) return { text: normalized, blocked: true, pattern };
  return { text: normalized, blocked: false };
}
