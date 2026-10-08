"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HISTORY_KINDS, LOAD_KEY, type HistoryEntry, type HistoryKind } from "@/lib/history";
import { historyApi } from "@/lib/history-client";
import { cn } from "@/lib/utils";

const dateFormat = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" });

export function HistoryBrowser() {
  const router = useRouter();
  const [kind, setKind] = useState<HistoryKind>("rfq");
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (tab: HistoryKind) => {
    setEntries(null);
    setError(null);
    try {
      setEntries(await historyApi.list(tab));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load History.");
      setEntries([]);
    }
  }, []);

  useEffect(() => {
    void refresh(kind);
  }, [kind, refresh]);

  async function load(entry: HistoryEntry) {
    setBusy(entry.id);
    try {
      const data = await historyApi.load(entry.kind, entry.id);
      sessionStorage.setItem(LOAD_KEY, JSON.stringify({ kind: entry.kind, data }));
      router.push("/documents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load that entry.");
      setBusy(null);
    }
  }

  async function remove(entry: HistoryEntry) {
    if (!window.confirm(`Delete "${entry.title}"? This can't be undone.`)) return;
    setBusy(entry.id);
    try {
      await historyApi.remove(entry.kind, entry.id);
      setEntries((prev) => prev?.filter((e) => e.id !== entry.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that entry.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4">
      <div role="tablist" aria-label="Document type" className="bg-muted inline-flex w-fit gap-1 rounded-lg p-1">
        {HISTORY_KINDS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={kind === tab.id}
            onClick={() => setKind(tab.id)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              kind === tab.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Card className="py-2">
        <CardContent className="px-0">
          {entries === null ? (
            <p className="text-muted-foreground flex items-center gap-2 px-6 py-6 text-sm">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </p>
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground px-6 py-6 text-sm">
              Nothing saved here yet. Use “Save” on the Documents page to keep a{" "}
              {HISTORY_KINDS.find((t) => t.id === kind)?.label}.
            </p>
          ) : (
            <ul className="divide-y">
              {entries.map((entry) => (
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
