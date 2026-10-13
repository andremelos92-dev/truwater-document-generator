"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { History, Loader2 } from "lucide-react";

import { Changes, dateFormat, OpenButtons } from "@/components/history-browser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { projectUrl, type RecentSave } from "@/lib/history";
import { historyApi } from "@/lib/history-client";

/** Dashboard card: the latest saves across every project, with what changed and who saved it. */
export function RecentDocuments() {
  const [saves, setSaves] = useState<RecentSave[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    historyApi
      .recent()
      .then(setSaves)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load recent documents.");
        setSaves([]);
      });
  }, []);

  return (
    <Card className="mt-6">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Recent Documents</CardTitle>
        <Link href="/history" className="text-primary text-sm font-medium hover:underline">
          View history
        </Link>
      </CardHeader>
      {saves === null ? (
        <CardContent className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </CardContent>
      ) : saves.length === 0 ? (
        <CardContent className="grid justify-items-center gap-2 py-6 text-center">
          <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
            <History className="size-5" />
          </div>
          <p className="font-medium">{error ? "Recent documents couldn't be loaded" : "No recent documents"}</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            {error ?? "Use “Save project” on the Documents page and your saves will appear here."}
          </p>
        </CardContent>
      ) : (
        <CardContent className="px-0">
          <ul className="divide-y">
            {saves.map((save) => (
              <li key={`${save.key}/${save.id}`} className="flex flex-wrap items-start justify-between gap-3 px-6 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{save.title}</p>
                  <p className="text-muted-foreground text-xs">
                    Saved {dateFormat.format(new Date(save.savedAt))}
                    {save.savedBy && ` by ${save.savedBy}`}
                    {!save.latest && " · earlier version"}
                  </p>
                  <Changes changes={save.changes} limit={2} />
                </div>
                <OpenButtons
                  href={projectUrl(save.key, save.latest ? undefined : save.id)}
                  label={`Open ${save.title}`}
                  primary={save.latest}
                />
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
