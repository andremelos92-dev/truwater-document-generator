"use client";

import type { ProjectSummary, ProjectVersion } from "@/lib/history";
import type { ProposalData } from "@/lib/proposal";

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Something went wrong.");
  return response.json() as Promise<T>;
}

export type SaveResult = { key: string; version?: ProjectVersion; unchanged?: boolean };

export const historyApi = {
  projects: () => call<{ projects: ProjectSummary[] }>("/api/history").then((r) => r.projects),
  versions: (key: string) => call<{ versions: ProjectVersion[] }>(`/api/history/${key}`).then((r) => r.versions),
  save: (data: ProposalData) =>
    call<SaveResult>("/api/history", { method: "POST", body: JSON.stringify({ data }) }),
  /** A save's form data; "latest" is the project's newest save. */
  load: (key: string, version = "latest") =>
    call<{ id: string; data: Partial<ProposalData> }>(`/api/history/${key}/${version}`),
  removeProject: (key: string) => call<{ ok: true }>(`/api/history/${key}`, { method: "DELETE" }),
  removeVersion: (key: string, version: string) =>
    call<{ ok: true }>(`/api/history/${key}/${version}`, { method: "DELETE" }),
};
