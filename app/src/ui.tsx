import { useCallback, useEffect, useState } from "react";
import type { JobStatus, MissionStatus } from "./api";

export function PageHead({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <header className="page-head">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h2>{title}</h2>
      {sub && <p>{sub}</p>}
    </header>
  );
}

const STATUS_CLASS: Record<string, string> = {
  created: "pending", running: "running", done: "done", error: "failed",
  queued: "queued", held: "pending",
  proposed: "pending", confirmed: "confirmed", retracted: "retracted",
};

export function Badge({ status }: { status: MissionStatus | JobStatus | string }) {
  return <span className={`badge ${STATUS_CLASS[status] ?? ""}`}>{status}</span>;
}

export function Empty({ glyph = "∅", children }: { glyph?: string; children: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="glyph">{glyph}</div>
      <p>{children}</p>
    </div>
  );
}

export function Alert({ kind, children }: { kind: "err" | "ok"; children: React.ReactNode }) {
  return <div className={`alert ${kind}`}>{children}</div>;
}

// ── Client-side mission registry ─────────────────────
// The API has no list-missions endpoint, so we remember ids we created here.
export interface TrackedMission {
  id: string;
  objective: string;
  createdAt: string;
  status?: MissionStatus;
}
const KEY = "veritas.missions";

export function useTrackedMissions() {
  const [missions, setMissions] = useState<TrackedMission[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "[]") as TrackedMission[];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const sync = () => {
      try {
        setMissions(JSON.parse(localStorage.getItem(KEY) ?? "[]") as TrackedMission[]);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const track = useCallback((m: TrackedMission) => {
    setMissions((prev) => {
      const next = [m, ...prev.filter((x) => x.id !== m.id)].slice(0, 50);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { missions, track };
}
