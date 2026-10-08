import Link from "next/link";
import { ArrowRight, Construction, FileSpreadsheet, FileText, History, Receipt } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const QUICK_ACTIONS = [
  {
    title: "RFQ",
    description: "Project summary and tower specification for the engineers.",
    icon: FileSpreadsheet,
    href: "/documents",
  },
  {
    title: "Technical Proposal",
    description: "Cover page for the customer or regional partner.",
    icon: FileText,
    href: "/documents",
  },
  {
    title: "Commercial Proposal",
    description: "Pricing, terms and conditions for each tower.",
    icon: Receipt,
    href: "/documents?tab=commercial",
  },
];

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome to the Truwater Document Generator. Start a new document or pick up a previous one.
        </p>
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <Construction className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-semibold">In development:</span> this tool is still being tested. Please review
            every generated document before sending it, and report any issues you find.
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {QUICK_ACTIONS.map(({ title, description, icon: Icon, href }) => (
          <Link
            key={title}
            href={href}
            className="group bg-card hover:border-primary/50 flex flex-col gap-3 rounded-xl border p-5 shadow-sm transition-all hover:shadow-md"
          >
            <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
              <Icon className="size-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">{title}</h2>
              <p className="text-muted-foreground mt-1 text-sm">{description}</p>
            </div>
            <span className="text-primary inline-flex items-center gap-1 text-sm font-medium">
              Start new
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </section>

      <Card className="mt-6">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Recent Documents</CardTitle>
          <Link href="/history" className="text-primary text-sm font-medium hover:underline">
            View history
          </Link>
        </CardHeader>
        <CardContent className="grid justify-items-center gap-2 py-6 text-center">
          <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
            <History className="size-5" />
          </div>
          <p className="font-medium">No recent documents</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            Documents you generate will appear here once document history is available.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
