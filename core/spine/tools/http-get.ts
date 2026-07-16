/**
 * http_get — fetch a URL over HTTP(S).
 *
 * riskTier `active`: network side effect, scope-gated. The scope gate (invariant
 * #1) denies off-scope hosts, loopback, and private ranges BEFORE this runs, so
 * `run()` here does no scope logic of its own — it trusts that execute() already
 * gated the call.
 */
import { z } from "zod";
import type { Tool } from "./registry.ts";

const inputSchema = z.object({
  url: z.string().url().describe("Absolute http(s) URL whose host is inside the mission scope."),
});
type Input = z.infer<typeof inputSchema>;

const MAX_BYTES = 100_000;
const TIMEOUT_MS = 15_000;

export const httpGetTool: Tool<Input> = {
  name: "http_get",
  description: "HTTP GET a URL inside the mission scope and return status + body (truncated).",
  inputSchema,
  riskTier: "active",
  scopeTargets: (input) => [{ kind: "network", value: input.url }],
  run: async (input) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(input.url, { signal: controller.signal, redirect: "manual" });
      const body = await res.text();
      const truncated = body.length > MAX_BYTES ? `${body.slice(0, MAX_BYTES)}\n...[truncated]` : body;
      return `HTTP ${res.status} ${res.statusText}\n\n${truncated}`;
    } finally {
      clearTimeout(timer);
    }
  },
};
