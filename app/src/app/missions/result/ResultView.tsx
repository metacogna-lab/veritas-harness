"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ApiIngestSuccess, DimensionResult } from "@core/types";

function DimensionRow({ dim }: { dim: DimensionResult }) {
  const icon = dim.pass ? "✓" : dim.required ? "✗" : "⚠";
  const color = dim.pass
    ? "text-green-400"
    : dim.required
      ? "text-red-400"
      : "text-yellow-400";

  return (
    <tr className="border-t border-neutral-800">
      <td className={`py-2 pr-4 font-mono text-xs ${color}`}>{icon}</td>
      <td className="py-2 pr-4 font-mono text-xs text-neutral-400">{dim.id}</td>
      <td className="py-2 pr-4 text-xs text-neutral-500">{dim.required ? "required" : "advisory"}</td>
      <td className="py-2 text-xs text-neutral-300">{dim.reason}</td>
    </tr>
  );
}

export function ResultView() {
  const params = useSearchParams();
  const slug = params.get("slug") ?? "";
  const [result, setResult] = useState<ApiIngestSuccess | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("veritas_result");
    if (raw) {
      try {
        setResult(JSON.parse(raw));
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  if (!result) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-neutral-100">Mission Plan</h1>
        <p className="text-neutral-400 text-sm">
          No plan data found.{" "}
          <a href="/ingest" className="text-neutral-200 underline">
            Create a new mission plan
          </a>
          .
        </p>
      </div>
    );
  }

  const { plan, score, dimensions } = result;
  const pct = Math.round(score * 100);
  const cliCommand = `bun run dev start --plan missions/${slug}/research-plan.json`;
  const planJson = JSON.stringify(plan, null, 2);

  async function downloadPlan() {
    const blob = new Blob([planJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-research-plan.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyCommand() {
    await navigator.clipboard.writeText(cliCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-green-500 bg-green-950/40 border border-green-800 rounded px-2 py-1">
            STEP 1 COMPLETE
          </span>
          <h1 className="text-2xl font-bold text-neutral-100">Mission Plan: {slug}</h1>
        </div>
        <p className="text-neutral-400 text-sm">{plan.objective}</p>
      </div>

      {/* Dogma Gate summary */}
      <section className="border border-neutral-800 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-neutral-200">Dogma Gate</h2>
          <span className="text-green-400 font-bold text-sm">✓ PASS — {pct}%</span>
        </div>
        <table className="w-full">
          <tbody>
            {dimensions.map((d) => (
              <DimensionRow key={d.id} dim={d} />
            ))}
          </tbody>
        </table>
      </section>

      {/* Plan metadata */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {[
          { label: "Loadout", value: plan.loadout },
          { label: "Target", value: plan.target },
          { label: "Phases", value: String(plan.phases.length) },
          { label: "Specialists", value: String(plan.specialists.length) },
        ].map(({ label, value }) => (
          <div key={label} className="space-y-1">
            <div className="text-neutral-500 uppercase tracking-wider text-xs">{label}</div>
            <div className="text-neutral-200 font-mono text-xs">{value}</div>
          </div>
        ))}
      </section>

      {/* STEP 2 handoff */}
      <section className="border border-neutral-700 rounded-lg p-6 space-y-4 bg-neutral-900/40">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-neutral-500 bg-neutral-900 border border-neutral-700 rounded px-2 py-1">
            STEP 2
          </span>
          <h2 className="font-semibold text-neutral-200">Run the Mission</h2>
        </div>
        <p className="text-neutral-400 text-sm">
          Download the plan, place it at{" "}
          <code className="text-green-400 text-xs font-mono">
            harness/veritas-example/missions/{slug}/research-plan.json
          </code>
          , then run:
        </p>
        <div className="flex items-center gap-3 bg-neutral-950 border border-neutral-700 rounded px-4 py-3">
          <code className="text-green-300 text-xs font-mono flex-1 overflow-x-auto whitespace-nowrap">
            {cliCommand}
          </code>
          <button
            onClick={copyCommand}
            className="text-xs text-neutral-400 hover:text-neutral-200 border border-neutral-700 rounded px-2 py-1 transition-colors shrink-0"
          >
            {copied ? "copied" : "copy"}
          </button>
        </div>
      </section>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={downloadPlan}
          className="bg-neutral-100 text-neutral-900 text-sm font-semibold px-4 py-2 rounded hover:bg-white transition-colors"
        >
          Download research-plan.json
        </button>
        <a
          href="/ingest"
          className="border border-neutral-700 text-neutral-300 text-sm px-4 py-2 rounded hover:border-neutral-500 hover:text-neutral-100 transition-colors"
        >
          New mission
        </a>
      </div>

      {/* Raw JSON accordion */}
      <details className="border border-neutral-800 rounded-lg">
        <summary className="px-4 py-3 cursor-pointer text-sm text-neutral-400 hover:text-neutral-200 transition-colors">
          View raw research-plan.json
        </summary>
        <pre className="px-4 py-4 text-xs text-green-300 font-mono overflow-x-auto border-t border-neutral-800 leading-relaxed">
          {planJson}
        </pre>
      </details>
    </div>
  );
}
