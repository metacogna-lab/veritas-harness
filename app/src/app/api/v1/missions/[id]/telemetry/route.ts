/**
 * GET /api/v1/missions/:id/telemetry
 *
 * Phase 1 stub — emits a single "complete" SSE event immediately.
 * Phase 2: streams live log events from an active harness sandbox.
 */
import type { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const event = JSON.stringify({
        type: "complete",
        ts: new Date().toISOString(),
        payload: { missionId: id, status: "stub — run mission via CLI" },
      });
      controller.enqueue(encoder.encode(`data: ${event}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
