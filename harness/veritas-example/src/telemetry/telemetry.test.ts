/**
 * Telemetry unit coverage (W4): bus routing, NDJSON logging, reader round-trip,
 * metric summarisation, and non-throwing isolation of a bad subscriber.
 */
import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventBus } from "./bus.ts";
import { StructuredLogger } from "./logger.ts";
import { readEvents, filterEvents, summarise } from "./reader.ts";
import type { HarnessEvent } from "./types.ts";

describe("EventBus", () => {
  it("delivers events to subscribers and unsubscribes", () => {
    const bus = new EventBus();
    const seen: HarnessEvent[] = [];
    const off = bus.on((e) => seen.push(e));
    bus.emit({ kind: "mission.start", missionId: "m1", slug: "s", objective: "o" });
    off();
    bus.emit({ kind: "mission.end", missionId: "m1", status: "ok", durationMs: 5 });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.kind).toBe("mission.start");
  });

  it("emit never throws even if a subscriber throws", () => {
    const bus = new EventBus();
    const seen: HarnessEvent[] = [];
    bus.on(() => {
      throw new Error("bad consumer");
    });
    bus.on((e) => seen.push(e));
    expect(() => bus.emit({ kind: "step.execute", missionId: "m", step: 1, tool: "read_file", riskTier: "safe" })).not.toThrow();
    expect(seen).toHaveLength(1); // the good subscriber still ran
  });
});

describe("StructuredLogger + reader", () => {
  it("writes NDJSON that the reader parses back into typed events", () => {
    const dir = mkdtempSync(join(tmpdir(), "veritas-telem-"));
    try {
      const file = join(dir, "run", "events.ndjson");
      const bus = new EventBus();
      const logger = new StructuredLogger({ file, now: () => "2026-07-13T00:00:00.000Z" });
      logger.attach(bus);

      bus.emit({ kind: "mission.start", missionId: "m1", slug: "demo", objective: "verify things" });
      bus.emit({ kind: "step.execute", missionId: "m1", step: 1, tool: "read_file", riskTier: "safe" });
      bus.emit({ kind: "tool.scope_deny", missionId: "m1", tool: "http_get", reason: "host not in scope" });
      bus.emit({ kind: "mission.end", missionId: "m1", status: "ok", durationMs: 42 });

      const events = readEvents(file);
      expect(events).toHaveLength(4);
      expect(events[0]).toEqual({ kind: "mission.start", missionId: "m1", slug: "demo", objective: "verify things" });

      const denies = filterEvents(events, ["tool.scope_deny"]);
      expect(denies).toHaveLength(1);

      const metrics = summarise(events);
      expect(metrics.missionId).toBe("m1");
      expect(metrics.slug).toBe("demo");
      expect(metrics.steps).toBe(1);
      expect(metrics.scopeDenials).toBe(1);
      expect(metrics.durationMs).toBe(42);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("log lines carry t + lvl envelope fields", () => {
    const dir = mkdtempSync(join(tmpdir(), "veritas-telem-"));
    try {
      const logger = new StructuredLogger({ file: join(dir, "e.ndjson"), now: () => "2026-07-13T00:00:00.000Z" });
      const line = logger.format({ kind: "provider.error", provider: "anthropic", error: "rate_limit" });
      const parsed = JSON.parse(line);
      expect(parsed.t).toBe("2026-07-13T00:00:00.000Z");
      expect(parsed.lvl).toBe("error");
      expect(parsed.kind).toBe("provider.error");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
