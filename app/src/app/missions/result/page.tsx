import { Suspense } from "react";
import { ResultView } from "./ResultView";

export const metadata = {
  title: "Mission Plan — Veritas",
};

export default function ResultPage() {
  return (
    <Suspense fallback={<p className="text-neutral-400 text-sm">Loading plan…</p>}>
      <ResultView />
    </Suspense>
  );
}
