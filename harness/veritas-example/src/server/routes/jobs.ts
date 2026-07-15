/**
 * Job routes (Feature 2). Mounted onto the API app when a queue is configured.
 * POST /v1/jobs enqueue · GET /v1/jobs list · GET /v1/jobs/:id status/result.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { JobQueue } from "../../jobs/queue.ts";
import type { JobType } from "../../jobs/types.ts";

const enqueueSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("mission"), planPath: z.string().optional(), loadout: z.string().optional(), maxSteps: z.number().int().positive().optional() }),
  z.object({ kind: z.literal("ingest"), slug: z.string().regex(/^[a-z0-9-]+$/), objective: z.string().min(1), target: z.string().optional() }),
]);

export function jobRoutes(queue: JobQueue): Hono {
  const app = new Hono();

  app.post("/v1/jobs", async (c) => {
    const parsed = enqueueSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
    const job = await queue.enqueue(parsed.data.kind as JobType, parsed.data);
    return c.json({ ok: true, id: job.id, status: job.status }, 202);
  });

  app.get("/v1/jobs", async (c) => {
    const status = c.req.query("status") as never;
    return c.json({ ok: true, jobs: await queue.list(status) });
  });

  app.get("/v1/jobs/:id", async (c) => {
    const job = await queue.get(c.req.param("id"));
    if (!job) return c.json({ ok: false, error: `unknown job ${c.req.param("id")}` }, 404);
    return c.json({ ok: true, job });
  });

  return app;
}
