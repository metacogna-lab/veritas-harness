import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Veritas",
  description: "Research meta-harness — safe, reproducible, evidence-grounded agent loops",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-neutral-800 px-6 py-4 flex items-center gap-4">
          <a href="/" className="text-neutral-100 font-bold tracking-tight text-lg hover:text-white">
            VERITAS
          </a>
          <span className="text-neutral-600 text-sm">meta-harness</span>
          <nav className="ml-auto flex gap-6 text-sm text-neutral-400">
            <a href="/ingest" className="hover:text-neutral-100 transition-colors">
              New Mission
            </a>
          </nav>
        </header>
        <main className="px-6 py-10 max-w-4xl mx-auto">{children}</main>
      </body>
    </html>
  );
}
