import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import { App } from "./App";
import { DashboardPage } from "./pages/DashboardPage";
import { IngestPage } from "./pages/IngestPage";
import { MissionsPage } from "./pages/MissionsPage";
import { MissionDetailPage } from "./pages/MissionDetailPage";
import { JobsPage } from "./pages/JobsPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "ingest", element: <IngestPage /> },
      { path: "missions", element: <MissionsPage /> },
      { path: "missions/:id", element: <MissionDetailPage /> },
      { path: "jobs", element: <JobsPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
