"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ApiIngestResult, DimensionResult } from "@/lib/veritas/types";

const LOADOUTS = [
  { value: "research", label: "research — structured missions from an ingested plan" },
  { value: "codebase-audit", label: "codebase-audit — read-only filesystem audit" },
  { value: "web-recon", label: "web-recon — authorised web host reconnaissance" },
] as const;

interface FieldErrors {
  slug?: string;
  objective?: string;
  target?: string;
  loadout?: string;
  file?: string;
}

function ViolationBadge({ dim }: { dim: DimensionResult }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className={dim.pass ? "text-green-400" : dim.required ? "text-red-400" : "text-yellow-400"}>
        {dim.pass ? "✓" : dim.required ? "✗" : "⚠"}
      </span>
      <div>
        <span className="font-mono text-xs text-neutral-400">[{dim.id}]</span>{" "}
        <span className={dim.pass ? "text-neutral-300" : "text-neutral-200"}>{dim.reason}</span>
      </div>
    </div>
  );
}

export function IngestForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [slug, setSlug] = useState("");
  const [objective, setObjective] = useState("");
  const [target, setTarget] = useState("");
  const [loadout, setLoadout] = useState<"research" | "codebase-audit" | "web-recon">("research");
  const [fileName, setFileName] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [violations, setViolations] = useState<DimensionResult[]>([]);

  function validate(): FieldErrors {
    const errs: FieldErrors = {};
    if (!slug.trim()) errs.slug = "Required";
    else if (!/^[a-z0-9-]+$/.test(slug.trim()))
      errs.slug = "Use only lowercase letters, numbers, and hyphens";
    if (!objective.trim()) errs.objective = "Required";
    else if (objective.trim().length < 25)
      errs.objective = `Too short (${objective.trim().length}/25 chars minimum). Be specific.`;
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    setViolations([]);

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    try {
      const form = new FormData();
      form.append("slug", slug.trim());
      form.append("objective", objective.trim());
      if (target.trim()) form.append("target", target.trim());
      form.append("loadout", loadout);
      const file = fileRef.current?.files?.[0];
      if (file) form.append("file", file);

      const res = await fetch("/api/v1/missions", { method: "POST", body: form });
      const data: ApiIngestResult = await res.json();

      if (data.ok) {
        sessionStorage.setItem("veritas_result", JSON.stringify(data));
        router.push(`/missions/result?slug=${encodeURIComponent(data.slug)}`);
      } else {
        setApiError(data.error);
        if ("violations" in data && data.violations) setViolations(data.violations);
      }
    } catch (err) {
      setApiError((err as Error).message ?? "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Slug */}
      <div className="space-y-1">
        <label className="block text-sm text-neutral-300" htmlFor="slug">
          Mission name <span className="text-neutral-600">(slug)</span>
        </label>
        <input
          id="slug"
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="auth-audit"
          className={`w-full bg-neutral-900 border rounded px-3 py-2 text-neutral-100 placeholder-neutral-600 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-neutral-500 ${
            fieldErrors.slug ? "border-red-500" : "border-neutral-700"
          }`}
        />
        {fieldErrors.slug && <p className="text-red-400 text-xs">{fieldErrors.slug}</p>}
        <p className="text-neutral-600 text-xs">Lowercase letters, numbers, and hyphens only</p>
      </div>

      {/* Objective */}
      <div className="space-y-1">
        <label className="block text-sm text-neutral-300" htmlFor="objective">
          Objective
        </label>
        <textarea
          id="objective"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          rows={3}
          placeholder="Verify that the scope gate blocks loopback addresses by reading src/safety/scope.ts line by line and confirming the deny rules"
          className={`w-full bg-neutral-900 border rounded px-3 py-2 text-neutral-100 placeholder-neutral-600 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-500 resize-none leading-relaxed ${
            fieldErrors.objective ? "border-red-500" : "border-neutral-700"
          }`}
        />
        {fieldErrors.objective && <p className="text-red-400 text-xs">{fieldErrors.objective}</p>}
        <p className="text-neutral-600 text-xs">
          Be specific and falsifiable. Vague objectives fail the Dogma Gate.
        </p>
      </div>

      {/* Target */}
      <div className="space-y-1">
        <label className="block text-sm text-neutral-300" htmlFor="target">
          Target <span className="text-neutral-600">(scope boundary)</span>
        </label>
        <input
          id="target"
          type="text"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="src/safety/  or  example.com"
          className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-neutral-100 placeholder-neutral-600 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-neutral-500"
        />
        <p className="text-neutral-600 text-xs">Filesystem path for local targets, hostname for web</p>
      </div>

      {/* Loadout */}
      <div className="space-y-1">
        <label className="block text-sm text-neutral-300" htmlFor="loadout">
          Loadout
        </label>
        <select
          id="loadout"
          value={loadout}
          onChange={(e) => setLoadout(e.target.value as typeof loadout)}
          className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-neutral-100 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-500"
        >
          {LOADOUTS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {/* File upload */}
      <div className="space-y-1">
        <label className="block text-sm text-neutral-300">
          Context file <span className="text-neutral-600">(optional .md or .txt)</span>
        </label>
        <div
          className="border border-dashed border-neutral-700 rounded px-4 py-6 text-center cursor-pointer hover:border-neutral-500 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          {fileName ? (
            <span className="text-green-400 text-sm font-mono">{fileName}</span>
          ) : (
            <span className="text-neutral-600 text-sm">Click to select or drag and drop</span>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".md,.txt"
          className="hidden"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
        {fieldErrors.file && <p className="text-red-400 text-xs">{fieldErrors.file}</p>}
      </div>

      {/* Gate violations */}
      {violations.length > 0 && (
        <div className="border border-red-900 bg-red-950/30 rounded p-4 space-y-2">
          <p className="text-red-400 text-sm font-semibold">Dogma Gate violations</p>
          {violations.map((v) => (
            <ViolationBadge key={v.id} dim={v} />
          ))}
          <p className="text-neutral-500 text-xs pt-1">
            Fix your objective or target and resubmit.
          </p>
        </div>
      )}

      {/* General API error */}
      {apiError && violations.length === 0 && (
        <div className="border border-red-900 bg-red-950/30 rounded p-4">
          <p className="text-red-400 text-sm">{apiError}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="bg-neutral-100 text-neutral-900 font-semibold text-sm px-5 py-2.5 rounded hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Compiling plan…" : "Create Mission Plan"}
      </button>
    </form>
  );
}
