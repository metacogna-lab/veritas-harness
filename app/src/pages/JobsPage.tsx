import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Job, type JobStatus } from "../api";
import { PageHead, Badge, Empty, Alert } from "../ui";

const FILTERS: (JobStatus | "all")[] = ["all", "queued", "running", "held", "done", "error"];

export function JobsPage() {
  const [filter, setFilter] = useState<JobStatus | "all">("all");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  // Jobs are poll-only (no SSE at the job level).
  useEffect(() => {
    let alive = true;
    const tick = () =>
      api.jobs(filter === "all" ? undefined : filter)
        .then((j) => { if (alive) { setJobs(j); setError(null); } })
        .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    tick();
    const t = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [filter]);

  const held = jobs.filter((j) => j.status === "held");

  return (
    <div>
      <PageHead
        eyebrow="autonomous"
        title="Job queue"
        sub="Durable Postgres-backed queue. The in-container worker claims jobs and runs them through the same gated control plane."
      />

      {held.length > 0 && (
        <div className="card" style={{ borderColor: "var(--amber)", marginBottom: 14 }}>
          <strong style={{ color: "var(--amber)" }}>⚑ {held.length} job(s) held for human release.</strong>
          <div className="muted">A consequential terminal action stopped one step short (safety invariant #5). Release it from your operator terminal.</div>
        </div>
      )}

      <div className="row" style={{ marginBottom: 14, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? "" : "ghost"} onClick={() => setFilter(f)} style={{ textTransform: "capitalize" }}>
            {f}
          </button>
        ))}
      </div>

      {error && <Alert kind="err">Queue unavailable — {error}. (Jobs require DATABASE_URL.)</Alert>}

      {!error && jobs.length === 0 ? (
        <Empty glyph="≣">No jobs {filter === "all" ? "yet" : `with status “${filter}”`}. Enqueue one from the Missions tab.</Empty>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr><th>Job</th><th>Type</th><th>Status</th><th>Attempts</th><th>Created</th></tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <>
                  <tr key={j.id} style={{ cursor: "pointer" }} onClick={() => setOpen(open === j.id ? null : j.id)}>
                    <td className="mono" style={{ fontSize: 12 }}>{j.id}</td>
                    <td>{j.type}</td>
                    <td><Badge status={j.status} /></td>
                    <td className="mono">{j.attempts}</td>
                    <td className="muted mono" style={{ fontSize: 12 }}>
                      {j.createdAt ? new Date(j.createdAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                  {open === j.id && (
                    <tr key={j.id + "-d"}>
                      <td colSpan={5} style={{ background: "var(--bg)" }}>
                        {j.error && <Alert kind="err">{j.error}</Alert>}
                        {typeof (j.result as { id?: string })?.id === "string" && (
                          <p>
                            Mission:{" "}
                            <Link to={`/missions/${(j.result as { id: string }).id}`}>
                              {(j.result as { id: string }).id}
                            </Link>
                          </p>
                        )}
                        <pre className="stream" style={{ maxHeight: 240 }}>
                          {JSON.stringify({ spec: j.spec, result: j.result }, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
