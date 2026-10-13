"use client";

import type { ProjectEntry } from "@/lib/history";
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
  list: () => call<{ entries: ProjectEntry[] }>("/api/history").then((r) => r.entries),
  save: (data: ProposalData) =>
    call<{ entry: ProjectEntry }>("/api/history", {
      method: "POST",
      body: JSON.stringify({ data }),
    }).then((r) => r.entry),
  load: (id: string) => call<Partial<ProposalData>>(`/api/history/${id}`),
  remove: (id: string) => call<{ ok: true }>(`/api/history/${id}`, { method: "DELETE" }),
};
