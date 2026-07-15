import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, useAsync } from "../api";
import { PageHead, Badge, Empty, Alert, useTrackedMissions } from "../ui";

const LOADOUTS = ["codebase-audit", "research", "web-recon"];

export function MissionsPage() {
  const nav = useNavigate();
  const { missions, track } = useTrackedMissions();
  const loadouts = useAsync(() => api.loadouts().catch(() => []), []);
  const options = loadouts.data?.length ? loadouts.data.map((l) => l.name) : LOADOUTS;

  const [mode, setMode] = useState<"objective" | "plan">("objective");
  const [objective, setObjective] = useState("");
  const [target, setTarget] = useState("");
  const [planPath, setPlanPath] = useState("");
  const [loadout, setLoadout] = useState(options[0]);
  const [maxSteps, setMaxSteps] = useState(20);
  const [runAsync, setRunAsync] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    try {
      const body =
        mode === "plan"
          ? { planPath, loadout, maxSteps }
          : { objective, target, loadout, maxSteps };
      const r = await api.createMission(body, runAsync);
      if (runAsync && r.jobId) {
        setNotice(`Enqueued as job ${r.jobId}.`);
        nav("/jobs");
        return;
      }
      if (r.id) {
        track({
          id: r.id,
          objective: mode === "plan" ? planPath : objective,
          createdAt: new Date().toISOString(),
          status: r.status as never,
        });
        nav(`/missions/${r.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHead
        eyebrow="control plane"
        title="Missions"
        sub="Start a gated ReAct mission from a raw objective or a compiled plan. Run sync to watch it live, or async to hand it to the job queue."
      />

      <div className="grid cols-2">
        <form className="card" onSubmit={submit}>
          <div className="row" style={{ marginBottom: 14 }}>
            <button type="button" className={mode === "objective" ? "" : "ghost"} onClick={() => setMode("objective")}>
              From objective
            </button>
            <button type="button" className={mode === "plan" ? "" : "ghost"} onClick={() => setMode("plan")}>
              From plan
            </button>
          </div>

          {mode === "objective" ? (
            <>
              <label className="field">
                <span>Objective</span>
                <textarea value={objective} onChange={(e) => setObjective(e.target.value)} required style={{ minHeight: 90 }}
                  placeholder="Enumerate write paths in the config loader and flag any that bypass the scope gate." />
              </label>
              <label className="field">
                <span>Target — path or host</span>
                <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="./src/config" required />
              </label>
            </>
          ) : (
            <label className="field">
              <span>Plan path — from an ingested brief</span>
              <input value={planPath} onChange={(e) => setPlanPath(e.target.value)} required
                placeholder="missions/auth-token-audit/research-plan.json" />
            </label>
          )}

          <div className="grid cols-2">
            <label className="field">
              <span>Loadout</span>
              <select value={loadout} onChange={(e) => setLoadout(e.target.value)}>
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Max steps</span>
              <input type="number" min={1} max={200} value={maxSteps} onChange={(e) => setMaxSteps(Number(e.target.value))} />
            </label>
          </div>

          <label className="row" style={{ gap: 8, marginBottom: 14 }}>
            <input type="checkbox" style={{ width: "auto" }} checked={runAsync} onChange={(e) => setRunAsync(e.target.checked)} />
            <span className="muted">Run async (enqueue as a job — requires Postgres queue)</span>
          </label>

          {error && <Alert kind="err">{error}</Alert>}
          {notice && <Alert kind="ok">{notice}</Alert>}
          <button disabled={busy}>{busy ? "Starting…" : runAsync ? "Enqueue mission" : "Start mission"}</button>
        </form>

        <div className="card">
          <strong>Tracked missions</strong>
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            The API has no list endpoint — these are missions this browser started.
          </p>
          {missions.length === 0 ? (
            <Empty glyph="⣿">No missions started from this browser yet.</Empty>
          ) : (
            <table style={{ marginTop: 8 }}>
              <thead><tr><th>Objective</th><th>Status</th></tr></thead>
              <tbody>
                {missions.map((m) => (
                  <tr key={m.id} style={{ cursor: "pointer" }} onClick={() => nav(`/missions/${m.id}`)}>
                    <td>
                      <Link to={`/missions/${m.id}`}>{m.objective.slice(0, 48)}{m.objective.length > 48 ? "…" : ""}</Link>
                      <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{m.id}</div>
                    </td>
                    <td><Badge status={m.status ?? "created"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
