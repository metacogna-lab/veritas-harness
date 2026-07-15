import { Link } from "react-router-dom";
import { api, useAsync } from "../api";
import { PageHead, Empty } from "../ui";
import { useTrackedMissions } from "../ui";

export function DashboardPage() {
  const health = useAsync(() => api.health(), []);
  const loadouts = useAsync(() => api.loadouts(), []);
  const held = useAsync(() => api.jobs("held").catch(() => []), []);
  const { missions } = useTrackedMissions();

  const h = health.data;

  return (
    <div>
      <PageHead
        eyebrow="control plane"
        title="Overview"
        sub="A tiered research meta-harness. Compose loadouts, run gated missions, watch telemetry live."
      />

      <div className="grid cols-3">
        <div className="card stat">
          <div className="label">Provider</div>
          <div className="value" style={{ fontSize: 18 }}>{h?.provider ?? "—"}</div>
          <div className="muted mono" style={{ fontSize: 12 }}>{h?.model ?? ""}</div>
        </div>
        <div className="card stat">
          <div className="label">Persistence</div>
          <div className="value" style={{ fontSize: 18 }}>{h ? (h.db ? "Postgres" : "in-memory") : "—"}</div>
          <div className="muted mono" style={{ fontSize: 12 }}>{h?.db ? "queue + jobs online" : "jobs disabled"}</div>
        </div>
        <div className="card stat">
          <div className="label">Loadouts</div>
          <div className="value">{loadouts.data?.length ?? "—"}</div>
          <div className="muted mono" style={{ fontSize: 12 }}>registered specialists</div>
        </div>
      </div>

      {held.data && held.data.length > 0 && (
        <div className="card" style={{ marginTop: 14, borderColor: "var(--amber)" }}>
          <div className="row between">
            <div>
              <strong>{held.data.length} job(s) awaiting human release.</strong>
              <div className="muted">A terminal action stopped one step short and needs your sign-off.</div>
            </div>
            <Link to="/jobs"><button className="ghost">Review queue →</button></Link>
          </div>
        </div>
      )}

      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="row between" style={{ marginBottom: 12 }}>
            <strong>Loadouts</strong>
            <Link to="/missions" className="mono" style={{ fontSize: 12 }}>run a mission →</Link>
          </div>
          {loadouts.error && <div className="muted">Unavailable — API offline.</div>}
          {loadouts.data?.length === 0 && <div className="muted">No loadouts registered.</div>}
          {loadouts.data?.map((l) => (
            <div key={l.name} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <div className="mono" style={{ color: "var(--accent)" }}>{l.name}</div>
              <div className="muted" style={{ fontSize: 13 }}>{l.description}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="row between" style={{ marginBottom: 12 }}>
            <strong>Recent missions</strong>
            <Link to="/missions" className="mono" style={{ fontSize: 12 }}>all →</Link>
          </div>
          {missions.length === 0 ? (
            <Empty glyph="◇">Nothing yet. Ingest a brief or start a mission.</Empty>
          ) : (
            missions.slice(0, 6).map((m) => (
              <Link
                key={m.id}
                to={`/missions/${m.id}`}
                style={{ display: "block", padding: "8px 0", borderBottom: "1px solid var(--border)" }}
              >
                <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{m.id}</div>
                <div style={{ color: "var(--text)" }}>{m.objective}</div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
