"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink, FolderOpen, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { projectUrl, type ProjectSummary, type ProjectVersion } from "@/lib/history";
import { historyApi } from "@/lib/history-client";

export const dateFormat = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" });

/** Change notes shown before "Show all". */
const NOTES_SHOWN = 4;

/** "Open" in this tab, plus an icon to open the same link in a new browser tab. */
export function OpenButtons({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  return (
    <div className="flex">
      <Button asChild size="sm" variant={primary ? "default" : "outline"} className="rounded-r-none">
        <Link href={href}>
          <FolderOpen /> Open
        </Link>
      </Button>
      <Button
        asChild
        size="sm"
        variant={primary ? "default" : "outline"}
        className="-ml-px rounded-l-none border-l border-l-white/30 px-2"
      >
        <a href={href} target="_blank" rel="noopener" aria-label={`${label} in a new tab`} title="Open in a new tab">
          <ExternalLink />
        </a>
      </Button>
    </div>
  );
}

/** A save's change notes, the first few with "Show all". */
export function Changes({ changes, limit = NOTES_SHOWN }: { changes: string[]; limit?: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? changes : changes.slice(0, limit);
  return (
    <ul className="text-muted-foreground mt-1 grid gap-0.5 text-xs">
      {shown.map((line, i) => (
        <li key={i} className="break-words">
          • {line}
        </li>
      ))}
      {changes.length > limit && (
        <li>
          <button type="button" className="text-primary font-medium hover:underline" onClick={() => setAll(!all)}>
            {all ? "Show less" : `Show all ${changes.length} changes`}
          </button>
        </li>
      )}
    </ul>
  );
}

/** Saved projects, most recently saved first; each opens on its latest save, or any earlier version. */
export function HistoryBrowser() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [versions, setVersions] = useState<Record<string, ProjectVersion[] | null>>({});
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    historyApi
      .projects()
      .then(setProjects)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load History.");
        setProjects([]);
      });
  }, []);

  async function toggle(key: string) {
    const next = new Set(open);
    if (next.has(key)) {
      next.delete(key);
      setOpen(next);
      return;
    }
    next.add(key);
    setOpen(next);
    if (versions[key]) return;
    setVersions((prev) => ({ ...prev, [key]: null }));
    try {
      const list = await historyApi.versions(key);
      setVersions((prev) => ({ ...prev, [key]: list }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the versions.");
    }
  }

  async function removeProject(project: ProjectSummary) {
    const count = project.versions === 1 ? "its save" : `all ${project.versions} saves`;
    if (!window.confirm(`Delete "${project.title}" and ${count}? This can't be undone.`)) return;
    setBusy(project.key);
    try {
      await historyApi.removeProject(project.key);
      setProjects((prev) => prev?.filter((p) => p.key !== project.key) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that project.");
    } finally {
      setBusy(null);
    }
  }

  async function removeVersion(project: ProjectSummary, version: ProjectVersion) {
    if (!window.confirm(`Delete the save of ${dateFormat.format(new Date(version.savedAt))}? This can't be undone.`))
      return;
    setBusy(version.id);
    try {
      await historyApi.removeVersion(project.key, version.id);
      const left = (versions[project.key] ?? []).filter((v) => v.id !== version.id);
      setVersions((prev) => ({ ...prev, [project.key]: left }));
      setProjects(
        (prev) =>
          prev
            ?.map((p) =>
              p.key !== project.key
                ? p
                : left.length
                  ? { ...p, versions: left.length, title: left[0].title, savedAt: left[0].savedAt }
                  : null
            )
            .filter((p): p is ProjectSummary => p !== null) ?? null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that version.");
    } finally {
      setBusy(null);
    }
  }

  const query = search.trim().toLowerCase();
  const shown = projects?.filter((p) => `${p.key} ${p.title}`.toLowerCase().includes(query)) ?? null;

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
              {projects?.length
                ? "No project matches that search."
                : "No projects saved yet. Use “Save project” on the Documents page."}
            </p>
          ) : (
            <ul className="divide-y">
              {shown.map((project) => {
                const expanded = open.has(project.key);
                const list = versions[project.key];
                return (
                  <li key={project.key} className="px-4 py-3 sm:px-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-start gap-2 text-left"
                        aria-expanded={expanded}
                        onClick={() => void toggle(project.key)}
                      >
                        {expanded ? (
                          <ChevronDown className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                        ) : (
                          <ChevronRight className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{project.title}</span>
                          <span className="text-muted-foreground block text-xs">
                            Last saved {dateFormat.format(new Date(project.savedAt))} · {project.versions}{" "}
                            {project.versions === 1 ? "version" : "versions"}
                          </span>
                        </span>
                      </button>
                      <div className="flex gap-2">
                        <OpenButtons href={projectUrl(project.key)} label={`Open ${project.title}`} primary />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={`Delete ${project.title}`}
                          title="Delete the project and all its versions"
                          onClick={() => removeProject(project)}
                          disabled={busy !== null}
                        >
                          {busy === project.key ? <Loader2 className="animate-spin" /> : <Trash2 />}
                        </Button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-3 ml-6 border-l pl-4">
                        {list === null || list === undefined ? (
                          <p className="text-muted-foreground flex items-center gap-2 text-sm">
                            <Loader2 className="size-4 animate-spin" /> Loading versions…
                          </p>
                        ) : (
                          <ol className="grid gap-3">
                            {list.map((version, index) => (
                                <li key={version.id} className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium">
                                      {dateFormat.format(new Date(version.savedAt))}
                                      {version.savedBy && (
                                        <span className="text-muted-foreground font-normal"> by {version.savedBy}</span>
                                      )}
                                      {index === 0 && (
                                        <span className="text-primary ml-2 text-xs font-semibold">LATEST</span>
                                      )}
                                      {version.title !== project.title && (
                                        <span className="text-muted-foreground ml-2 font-normal">
                                          saved as {version.title}
                                        </span>
                                      )}
                                    </p>
                                    <Changes changes={version.changes} />
                                  </div>
                                  <div className="flex gap-2">
                                    <OpenButtons
                                      href={projectUrl(project.key, version.id)}
                                      label={`Open the save of ${dateFormat.format(new Date(version.savedAt))}`}
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      aria-label="Delete this version"
                                      title="Delete this version"
                                      onClick={() => removeVersion(project, version)}
                                      disabled={busy !== null}
                                    >
                                      {busy === version.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                                    </Button>
                                  </div>
                                </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
