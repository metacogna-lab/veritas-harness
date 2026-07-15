/**
 * Server-Sent Events for live mission telemetry (Feature 1).
 *
 * Subscribes to the telemetry EventBus, filters to one mission, and streams each
 * event as an SSE `data:` frame. The stream ends (and unsubscribes) on `mission.end`
 * so subscribers never leak.
 */
import type { EventBus, HarnessEvent } from "../telemetry/index.ts";

function frame(event: HarnessEvent): string {
  return `event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`;
}

/** Build a ReadableStream of SSE frames for `missionId` over `bus`. */
export function streamMissionEvents(bus: EventBus, missionId: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      unsubscribe = bus.on((event) => {
        const eventMission = "missionId" in event ? event.missionId : undefined;
        if (eventMission !== missionId) return;
        try {
          controller.enqueue(encoder.encode(frame(event)));
          if (event.kind === "mission.end") {
            unsubscribe?.();
            controller.close();
          }
        } catch {
          unsubscribe?.();
        }
      });
    },
    cancel() {
      unsubscribe?.();
    },
  });
}

/** Standard SSE response headers. */
export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;
