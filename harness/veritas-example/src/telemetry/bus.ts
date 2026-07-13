/**
 * EventBus — typed, in-process pub/sub over eventemitter3 (W4).
 *
 * Pure routing, no business logic. `emit` is NON-THROWING by contract: telemetry
 * must never be able to fail a mission. A subscriber that throws is isolated so one
 * bad consumer cannot take down the loop or sibling consumers.
 */
import EventEmitter from "eventemitter3";
import type { HarnessEvent } from "./types.ts";

const CHANNEL = "harness-event";

export class EventBus {
  private readonly emitter = new EventEmitter();

  /** Subscribe to every harness event. Returns an unsubscribe function. */
  on(listener: (event: HarnessEvent) => void): () => void {
    this.emitter.on(CHANNEL, listener);
    return () => this.emitter.off(CHANNEL, listener);
  }

  /** Emit an event. Never throws — subscriber errors are swallowed per-listener. */
  emit(event: HarnessEvent): void {
    const listeners = this.emitter.listeners(CHANNEL) as Array<(e: HarnessEvent) => void>;
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // A telemetry consumer must never break the mission loop.
      }
    }
  }

  /** Remove all subscribers (used at mission close). */
  clear(): void {
    this.emitter.removeAllListeners(CHANNEL);
  }
}
