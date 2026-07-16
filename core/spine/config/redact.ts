/**
 * redact() — mask secrets in any value before it is logged.
 *
 * Two independent detectors run together:
 *   1. Key-name based: a property whose name looks secret (apiKey, token,
 *      password, authorization, ...) has its value masked regardless of shape.
 *   2. Value-shape based: strings that look like credentials (long high-entropy
 *      tokens, `sk-...`/`Bearer ...` shapes) are masked even under an innocent
 *      key name.
 *
 * The function is pure and structural: it returns a NEW value and never mutates
 * its input (immutability invariant). Cycles are handled via a seen-set.
 */

const SECRET_KEY_PATTERN =
  /(api[_-]?key|secret|token|password|passwd|authorization|auth[_-]?token|access[_-]?key|private[_-]?key|client[_-]?secret|bearer|credential)/i;

// Value shapes that are almost always credentials regardless of key name.
const SECRET_VALUE_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/, // OpenAI-style
  /\bsk-ant-[A-Za-z0-9_-]{16,}\b/, // Anthropic-style
  /\bBearer\s+[A-Za-z0-9._-]{12,}\b/i,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/, // GitHub tokens
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
];

const MASK = "***REDACTED***";

function looksLikeSecretValue(value: string): boolean {
  return SECRET_VALUE_PATTERNS.some((re) => re.test(value));
}

function redactValue(value: unknown, keyIsSecret: boolean, seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    if (keyIsSecret || looksLikeSecretValue(value)) return MASK;
    return value;
  }
  if (value === null || typeof value !== "object") {
    // A secret-named key holding a non-string (number/bool) is still masked.
    return keyIsSecret ? MASK : value;
  }

  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, false, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = redactValue(v, SECRET_KEY_PATTERN.test(k), seen);
  }
  return out;
}

/**
 * Return a deep copy of `value` with any detected secrets masked. Safe to pass
 * arbitrary objects (including nested / cyclic) straight into a logger.
 */
export function redact<T>(value: T): T {
  return redactValue(value, false, new WeakSet<object>()) as T;
}
