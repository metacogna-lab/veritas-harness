import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, openMissionStream, type HarnessEvent, type MissionStatus } from "../api";
import { PageHead, Badge, Empty, Alert } from "../ui";

type Tab = "live" | "report";

// One-line renderer for a telemetry frame — keeps the stream scannable.
function line(e: HarnessEvent): { text: string; tone?: string } {
  switch (e.kind) {
    case "mission.start": return { text: `mission started · ${e.objective ?? ""}` };
    case "mission.end": return { text: `mission ended · ${e.status} (${e.durationMs ?? "?"}ms)`, tone: e.status === "error" ? "var(--red)" : "var(--green)" };
    case "step.execute": return { text: `step ${e.step} · exec ${e.tool} [${e.riskTier}]`, tone: "var(--accent)" };
    case "step.observe": return { text: `step ${e.step} · observe ${e.ok ? "ok" : "fail"}`, tone: e.ok ? undefined : "var(--red)" };
    case "tool.scope_deny": return { text: `SCOPE DENIED · ${e.tool} — ${e.reason}`, tone: "var(--red)" };
    case "tool.gate_deny": return { text: `GATE DENIED · ${e.tool} [${e.tier}]`, tone: "var(--amber)" };
    case "finding.proposed": return { text: `finding proposed · ${e.findingId}`, tone: "var(--amber)" };
    case "finding.confirmed": return { text: `finding CONFIRMED · ${e.findingId}`, tone: "var(--green)" };
    case "finding.refuted": return { text: `finding refuted · ${e.findingId} — ${e.reason ?? ""}`, tone: "var(--red)" };
    case "provider.error": return { text: `provider error · ${e.reason ?? ""}`, tone: "var(--red)" };
    default: return { text: `${e.kind} ${JSON.stringify(e.raw ?? "")}` };
  }
}

export function MissionDetailPage() {
  const { id = "" } = useParams();
  const [tab, setTab] = useState<Tab>("live");
  const [status, setStatus] = useState<MissionStatus | null>(null);
  const [events, setEvents] = useState<HarnessEvent[]>([]);
  const [streaming, setStreaming] = useState(true);
  const [report, setReport] = useState<string | null>(null);
  const [reportErr, setReportErr] = useState<string | null>(null);
  const [statusErr, setStatusErr] = useState<string | null>(null);
  const streamRef = useRef<HTMLDivElement>(null);

  // Poll status.
  useEffect(() => {
    let alive = true;
    const tick = () =>
      api.mission(id)
        .then((m) => { if (alive) { setStatus(m.status); setStatusErr(null); } })
        .catch((e) => alive && setStatusErr(e instanceof Error ? e.message : String(e)));
    tick();
    const t = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [id]);

  // Live SSE.
  useEffect(() => {
    setEvents([]); setStreaming(true);
    const close = openMissionStream(id, (e) => {
      setEvents((prev) => [...prev, e]);
      if (e.kind === "mission.end") setStreaming(false);
    });
    return close;
  }, [id]);

  useEffect(() => {
    streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight });
  }, [events]);

  function loadReport() {
    setTab("report");
    if (report !== null) return;
    api.report(id).then((r) => setReport(r.report)).catch((e) => setReportErr(e instanceof Error ? e.message : String(e)));
  }

  return (
    <div>
      <div className="row between">
        <PageHead eyebrow="mission" title="Transcript" sub={id} />
        <div className="row">
          {status && <Badge status={status} />}
          {streaming && <span className="badge running">live</span>}
        </div>
      </div>

      {statusErr && <Alert kind="err">Status unavailable — {statusErr}</Alert>}

      <div className="row" style={{ marginBottom: 14 }}>
        <button className={tab === "live" ? "" : "ghost"} onClick={() => setTab("live")}>Live events</button>
        <button className={tab === "report" ? "" : "ghost"} onClick={loadReport}>Report</button>
        <div style={{ flex: 1 }} />
        <Link to="/missions"><button className="ghost">← All missions</button></Link>
      </div>

      {tab === "live" ? (
        events.length === 0 ? (
          <Empty glyph="≋">
            {streaming ? "Waiting for telemetry… (SSE requires the telemetry bus)" : "No events streamed."}
          </Empty>
        ) : (
          <div className="stream" ref={streamRef}>
            {events.map((e, i) => {
              const l = line(e);
              return (
                <div className="ln" key={i}>
                  <span className="ts">{String(i + 1).padStart(3, "0")}</span>
                  <span style={{ color: l.tone }}>{l.text}</span>
                </div>
              );
            })}
          </div>
        )
      ) : reportErr ? (
        <Alert kind="err">{reportErr}</Alert>
      ) : report === null ? (
        <Empty glyph="…">Loading report…</Empty>
      ) : (
        <div className="stream" style={{ maxHeight: 640 }}>{report}</div>
      )}
    </div>
  );
}
