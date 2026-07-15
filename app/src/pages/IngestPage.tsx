import { useState } from "react";
import { api, ApiError, useAsync, type IngestResult } from "../api";
import { PageHead, Alert } from "../ui";

const LOADOUTS = ["codebase-audit", "research", "web-recon"];

export function IngestPage() {
  const loadouts = useAsync(() => api.loadouts().catch(() => []), []);
  const options = loadouts.data?.length ? loadouts.data.map((l) => l.name) : LOADOUTS;

  const [slug, setSlug] = useState("");
  const [objective, setObjective] = useState("");
  const [target, setTarget] = useState("");
  const [loadout, setLoadout] = useState(options[0]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [violations, setViolations] = useState<unknown[] | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setResult(null); setError(null); setViolations(null);
    try {
      const r = await api.ingest({ slug, objective, target: target || undefined, loadout });
      setResult(r);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        const v = (err.body as { violations?: unknown[] })?.violations;
        if (Array.isArray(v)) setViolations(v);
      } else {
        setError(String(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHead
        eyebrow="intake"
        title="Ingest a brief"
        sub="Compile a research brief into a plan and run it through the Dogma Gate before any mission starts."
      />

      <div className="grid cols-2">
        <form className="card" onSubmit={submit}>
          <label className="field">
            <span>Slug — lowercase, digits, dashes</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              pattern="[a-z0-9-]+"
              placeholder="auth-token-audit"
              required
            />
          </label>
          <label className="field">
            <span>Objective</span>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Audit the session-token issuance path for replay and fixation weaknesses."
              required
              style={{ minHeight: 100 }}
            />
          </label>
          <label className="field">
            <span>Target — path or host (optional)</span>
            <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="./src/auth" />
          </label>
          <label className="field">
            <span>Loadout</span>
            <select value={loadout} onChange={(e) => setLoadout(e.target.value)}>
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <button disabled={busy}>{busy ? "Compiling…" : "Compile & gate"}</button>
        </form>

        <div className="card">
          <strong>Dogma Gate result</strong>
          {!result && !error && (
            <p className="muted" style={{ marginTop: 12 }}>
              Submit a brief to see its gate score and per-dimension breakdown. A failing plan is
              rejected before it can run.
            </p>
          )}
          {error && (
            <>
              <Alert kind="err">{error}</Alert>
              {violations && (
                <ul className="mono" style={{ fontSize: 13, color: "var(--red)" }}>
                  {violations.map((v, i) => <li key={i}>{typeof v === "string" ? v : JSON.stringify(v)}</li>)}
                </ul>
              )}
            </>
          )}
          {result && (
            <>
              <Alert kind="ok">Plan passed — written to <span className="mono">{result.planPath}</span></Alert>
              <div className="stat" style={{ margin: "10px 0" }}>
                <div className="label">Composite score</div>
                <div className="value">{result.score.toFixed(2)}</div>
              </div>
              <table>
                <thead><tr><th>Dimension</th><th>Score</th></tr></thead>
                <tbody>
                  {result.dimensions?.map((d, i) => (
                    <tr key={i}>
                      <td>{d.name ?? `dim ${i + 1}`}</td>
                      <td className="mono">{typeof d.score === "number" ? d.score.toFixed(2) : String(d.score)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
                Start a mission from this plan on the <a href="/missions">Missions</a> tab using plan path
                <span className="mono"> {result.planPath}</span>.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
