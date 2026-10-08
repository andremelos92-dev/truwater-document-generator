"use client";

import type { HistoryEntry, HistoryKind } from "@/lib/history";
import type { ProposalData } from "@/lib/proposal";

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Something went wrong.");
  return response.json() as Promise<T>;
}

export const historyApi = {
  list: (kind: HistoryKind) => call<{ entries: HistoryEntry[] }>(`/api/history?kind=${kind}`).then((r) => r.entries),
  save: (kind: HistoryKind, data: ProposalData) =>
    call<{ entry: HistoryEntry }>("/api/history", {
      method: "POST",
      body: JSON.stringify({ kind, data }),
    }).then((r) => r.entry),
  load: (kind: HistoryKind, id: string) => call<Partial<ProposalData>>(`/api/history/${kind}/${id}`),
  remove: (kind: HistoryKind, id: string) => call<{ ok: true }>(`/api/history/${kind}/${id}`, { method: "DELETE" }),
};
