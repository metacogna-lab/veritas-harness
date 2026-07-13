/**
 * LogReader — parse events.ndjson back into typed events, and summarise them into
 * MissionMetrics (W4). This is the RSI outer loop's query interface into the inner
 * loop's execution history — the concrete inner→outer boundary from PHASE2 B5.
 */
import { readFileSync } from "node:fs";
import type { HarnessEvent, HarnessEventKind, MissionMetrics } from "./types.ts";

/** Read + parse an NDJSON events file. Malformed lines are skipped, not fatal. */
export function readEvents(ndjsonPath: string): HarnessEvent[] {
  const raw = readFileSync(ndjsonPath, "utf8");
  const events: HarnessEvent[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      if (typeof obj.kind === "string") {
        // Drop the log-envelope fields; keep the event shape.
        const { t: _t, lvl: _lvl, ...event } = obj;
        events.push(event as unknown as HarnessEvent);
      }
    } catch {
      // skip malformed line
    }
  }
  return events;
}

/** Keep only events of the given kinds. */
export function filterEvents(events: HarnessEvent[], kinds: HarnessEventKind[]): HarnessEvent[] {
  const set = new Set<HarnessEventKind>(kinds);
  return events.filter((e) => set.has(e.kind));
}

/** Fold an event stream into per-mission counters. */
export function summarise(events: HarnessEvent[]): MissionMetrics {
  const metrics: MissionMetrics = {
    missionId: "",
    slug: "",
    durationMs: 0,
    steps: 0,
    scopeDenials: 0,
    gateDenials: 0,
    findings: { proposed: 0, refuted: 0, confirmed: 0 },
    providerErrors: 0,
  };

  for (const e of events) {
    switch (e.kind) {
      case "mission.start":
        metrics.missionId = e.missionId;
        metrics.slug = e.slug;
        break;
      case "mission.end":
        metrics.durationMs = e.durationMs;
        break;
      case "step.execute":
        metrics.steps += 1;
        break;
      case "tool.scope_deny":
        metrics.scopeDenials += 1;
        break;
      case "tool.gate_deny":
        metrics.gateDenials += 1;
        break;
      case "finding.proposed":
        metrics.findings.proposed += 1;
        break;
      case "finding.refuted":
        metrics.findings.refuted += 1;
        break;
      case "finding.confirmed":
        metrics.findings.confirmed += 1;
        break;
      case "provider.error":
        metrics.providerErrors += 1;
        break;
    }
  }

  return metrics;
}
