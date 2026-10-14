import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProjectTracker } from "@/components/project-tracker";
import { masterUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Projects · Truwater Document Generator" };

// Master account only: for anyone else this page doesn't exist.
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  if (!(await masterUser())) notFound();
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
          Projects
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold tracking-normal text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            Trial
          </span>
        </h1>
        <p className="text-muted-foreground mt-2">
          Where each project is up to: which documents are done, who to follow up and when. Only you can see this page.
        </p>
      </header>
      <ProjectTracker />
    </main>
  );
}
