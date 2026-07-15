import { NavLink, Outlet } from "react-router-dom";
import { useApiHealth } from "./api";

const NAV = [
  { to: "/", label: "Overview", k: "◇", end: true },
  { to: "/ingest", label: "Ingest brief", k: "▸", end: false },
  { to: "/missions", label: "Missions", k: "⣿", end: false },
  { to: "/jobs", label: "Job queue", k: "≣", end: false },
];

export function App() {
  const health = useApiHealth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>veritas<span className="dot">·</span></h1>
          <small>console</small>
        </div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
          >
            <span className="k">{n.k}</span>
            {n.label}
          </NavLink>
        ))}
        <div className="spacer" />
        <div className={"api-status" + (health.ok ? "" : " down")}>
          api <b>{health.ok ? "online" : "unreachable"}</b>
          <div>{health.base}</div>
        </div>
      </aside>
      <main className="main fade-in">
        <Outlet />
      </main>
    </div>
  );
}
