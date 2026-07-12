import { IngestForm } from "./IngestForm";

export const metadata = {
  title: "New Mission Plan — Veritas",
};

export default function IngestPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-neutral-500 bg-neutral-900 border border-neutral-700 rounded px-2 py-1">
            STEP 1
          </span>
          <h1 className="text-2xl font-bold text-neutral-100">New Mission Plan</h1>
        </div>
        <p className="text-neutral-400 text-sm">
          Describe what you want to investigate. The plan will be compiled and validated against
          eight research-discipline gates before you can run it.
        </p>
      </div>

      <IngestForm />
    </div>
  );
}
