import type { Metadata } from "next";

import { HistoryBrowser } from "@/components/history-browser";

export const metadata: Metadata = { title: "History · Truwater Document Generator" };

export default function HistoryPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <p className="text-muted-foreground mt-2">
          Saved projects, one per TTA quote number (the latest save). Load one to fill the RFQ, Technical
          Proposal, Commercial Proposal and Inquiry Form again, then generate any document without retyping.
        </p>
      </header>
      <HistoryBrowser />
    </main>
  );
}
