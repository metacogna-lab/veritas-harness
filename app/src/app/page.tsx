import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="space-y-4">
        <h1 className="text-3xl font-bold text-neutral-100 tracking-tight">
          Safe. Reproducible. Evidence-grounded.
        </h1>
        <p className="text-neutral-400 text-lg max-w-2xl leading-relaxed">
          Veritas is a research meta-harness. It stamps out safe agent loops for any objective
          domain without rewriting the core each time. Every finding must survive a second model
          trying to disprove it.
        </p>
      </section>

      {/* Two-step model */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-neutral-800 rounded-lg p-6 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-neutral-500 bg-neutral-900 border border-neutral-700 rounded px-2 py-1">
              STEP 1
            </span>
            <h2 className="text-neutral-100 font-semibold">Create a Mission Plan</h2>
          </div>
          <p className="text-neutral-400 text-sm leading-relaxed">
            Express your research intention. The ingest pipeline compiles it into a validated{" "}
            <code className="text-green-400 text-xs">research-plan.json</code> that passes eight
            epistemic gates before any agent is allowed to run.
          </p>
          <div className="pt-2">
            <Link
              href="/ingest"
              className="inline-flex items-center gap-2 bg-neutral-100 text-neutral-900 text-sm font-medium px-4 py-2 rounded hover:bg-white transition-colors"
            >
              New Mission Plan
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>

        <div className="border border-neutral-800 rounded-lg p-6 space-y-3 opacity-60">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-neutral-500 bg-neutral-900 border border-neutral-700 rounded px-2 py-1">
              STEP 2
            </span>
            <h2 className="text-neutral-100 font-semibold">Run the Mission</h2>
          </div>
          <p className="text-neutral-400 text-sm leading-relaxed">
            The validated plan drives a scoped ReAct agent loop. Tools are gated by risk tier.
            Every finding passes through an adversarial refuter before it is confirmed.
          </p>
          <p className="text-xs text-neutral-600 font-mono">
            bun run dev start --plan missions/&lt;slug&gt;/research-plan.json
          </p>
        </div>
      </section>

      {/* Quick facts */}
      <section className="border-t border-neutral-800 pt-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
        {[
          { label: "Safety gates", value: "8 dogma dimensions" },
          { label: "Scope enforcement", value: "Deny off-scope by default" },
          { label: "Findings", value: "Refuted before confirmed" },
          { label: "Claims", value: "Re-derived from artifacts" },
        ].map(({ label, value }) => (
          <div key={label} className="space-y-1">
            <div className="text-neutral-500 uppercase tracking-wider text-xs">{label}</div>
            <div className="text-neutral-200">{value}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
