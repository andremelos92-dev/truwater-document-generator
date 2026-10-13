"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LOAD_KEY, type ProjectEntry } from "@/lib/history";
import { historyApi } from "@/lib/history-client";

const dateFormat = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" });

/** Saved projects, newest first: load one to fill the Documents form again, or delete it. */
export function HistoryBrowser() {
  const router = useRouter();
  const [entries, setEntries] = useState<ProjectEntry[] | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    historyApi
      .list()
      .then(setEntries)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load History.");
        setEntries([]);
      });
  }, []);

  async function load(entry: ProjectEntry) {
    setBusy(entry.id);
    try {
      const data = await historyApi.load(entry.id);
      sessionStorage.setItem(LOAD_KEY, JSON.stringify({ data }));
      router.push("/documents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load that project.");
      setBusy(null);
    }
  }

  async function remove(entry: ProjectEntry) {
    if (!window.confirm(`Delete "${entry.title}"? This can't be undone.`)) return;
    setBusy(entry.id);
    try {
      await historyApi.remove(entry.id);
      setEntries((prev) => prev?.filter((e) => e.id !== entry.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that project.");
    } finally {
      setBusy(null);
    }
  }

  const query = search.trim().toLowerCase();
  const shown = entries?.filter((entry) => entry.title.toLowerCase().includes(query)) ?? null;

  return (
    <div className="grid gap-4">
      <Input
        type="search"
        aria-label="Search projects"
        placeholder="Search by quote number or project name"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="sm:max-w-sm"
      />

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Card className="py-2">
        <CardContent className="px-0">
          {shown === null ? (
            <p className="text-muted-foreground flex items-center gap-2 px-6 py-6 text-sm">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </p>
          ) : shown.length === 0 ? (
            <p className="text-muted-foreground px-6 py-6 text-sm">
              {entries?.length
                ? "No project matches that search."
                : "No projects saved yet. Use “Save project” on the Documents page."}
            </p>
          ) : (
            <ul className="divide-y">
              {shown.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{entry.title}</p>
                    <p className="text-muted-foreground text-xs">Saved {dateFormat.format(new Date(entry.savedAt))}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={() => load(entry)} disabled={busy !== null}>
                      {busy === entry.id ? <Loader2 className="animate-spin" /> : <FolderOpen />} Load
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Delete ${entry.title}`}
                      onClick={() => remove(entry)}
                      disabled={busy !== null}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
