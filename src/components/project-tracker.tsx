"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BellRing, ChevronDown, ExternalLink, Loader2, Mail, Phone, Plus, Trash2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { projectKey, projectUrl, type ProjectSummary } from "@/lib/history";
import {
  CONTACT_KINDS,
  contactOf,
  createProject,
  dueState,
  newId,
  openFollowUps,
  progress,
  PROJECT_STATUSES,
  STAGE_STATUSES,
  STAGES,
  telLink,
  today,
  type Contact,
  type ContactKind,
  type FollowUp,
  type ProjectStatus,
  type StageId,
  type StageStatus,
  type TrackedProject,
} from "@/lib/tracker";
import { cn } from "@/lib/utils";

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init.headers } });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Something went wrong.");
  return response.json() as Promise<T>;
}

const STAGE_STYLE: Record<StageStatus, string> = {
  todo: "border-border bg-background text-muted-foreground",
  doing: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200",
  review: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200",
  done: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200",
  na: "border-dashed border-border bg-muted/40 text-muted-foreground line-through",
};

const STATUS_STYLE: Record<ProjectStatus, string> = {
  active: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200",
  onHold: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
  won: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
  lost: "bg-muted text-muted-foreground",
};

const DUE_STYLE = {
  overdue: "text-red-600 dark:text-red-400 font-semibold",
  today: "text-amber-700 dark:text-amber-300 font-semibold",
  later: "text-foreground",
  none: "text-muted-foreground",
};

const dateFormat = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" });
const dateTimeFormat = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" });

/** "Overdue · 3 Oct", "Today", "Fri 17 Oct" for a YYYY-MM-DD date. */
function dueLabel(due: string): string {
  if (!due) return "No date";
  const state = dueState(due);
  const date = dateFormat.format(new Date(`${due}T00:00:00`));
  return state === "overdue" ? `Overdue · ${date}` : state === "today" ? "Today" : date;
}

const statusLabel = (status: ProjectStatus) => PROJECT_STATUSES.find((s) => s.id === status)!.label;
const stageStatusLabel = (status: StageStatus) => STAGE_STATUSES.find((s) => s.id === status)!.label;

export function ProjectTracker() {
  const [projects, setProjects] = useState<TrackedProject[] | null>(null);
  const [history, setHistory] = useState<ProjectSummary[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ProjectStatus | "all">("active");
  const [draft, setDraft] = useState({ quote: "", name: "", customer: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [{ projects: list }, saved] = await Promise.all([
        call<{ projects: TrackedProject[] }>("/api/tracker"),
        call<{ projects: ProjectSummary[] }>("/api/history").catch(() => ({ projects: [] as ProjectSummary[] })),
      ]);
      setProjects(list);
      setHistory(saved.projects);
    } catch (err) {
      setProjects([]);
      setError(err instanceof Error ? err.message : "Could not load the projects.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const historyKeys = useMemo(() => new Set(history.map((p) => p.key)), [history]);
  const tracked = useMemo(() => new Set((projects ?? []).map((p) => p.id)), [projects]);
  const untracked = history.filter((p) => !tracked.has(p.key));

  /** Saves a project (the screen updates straight away). */
  async function save(project: TrackedProject) {
    setProjects((list) => (list ?? []).map((p) => (p.id === project.id ? project : p)));
    try {
      await call(`/api/tracker/${encodeURIComponent(project.id)}`, { method: "PUT", body: JSON.stringify(project) });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the project.");
    }
  }

  // The projects as last shown, for saving a box when it is left (after any spelling correction).
  const latest = useRef(projects);
  latest.current = projects;
  const saveLatest = (id: string) => {
    const project = latest.current?.find((p) => p.id === id);
    if (project?.name.trim()) void save(project);
  };

  /** Changes a project on screen only (text being typed); `saveLatest` it when the box is left. */
  const edit = (project: TrackedProject) =>
    setProjects((list) => (list ?? []).map((p) => (p.id === project.id ? project : p)));

  async function add(quote: string, name: string, customer: string) {
    if (!name.trim()) return;
    const id = projectKey(quote) || `P-${newId()}`;
    if (tracked.has(id)) {
      setError(`${quote.trim()} is already in your projects.`);
      setOpenId(id);
      return;
    }
    const project = createProject(quote, name, customer, id);
    setBusy("add");
    try {
      await call(`/api/tracker/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(project) });
      setProjects((list) => [project, ...(list ?? [])]);
      setDraft({ quote: "", name: "", customer: "" });
      setFilter("active");
      setOpenId(id);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the project.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(project: TrackedProject) {
    if (!window.confirm(`Remove ${project.name} from your projects? Its documents in History stay.`)) return;
    setBusy(project.id);
    try {
      await call(`/api/tracker/${encodeURIComponent(project.id)}`, { method: "DELETE" });
      setProjects((list) => (list ?? []).filter((p) => p.id !== project.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the project.");
    } finally {
      setBusy(null);
    }
  }

  const followUps = useMemo(
    () =>
      (projects ?? [])
        .filter((p) => p.status === "active" || p.status === "onHold")
        .flatMap((project) => openFollowUps(project).map((followUp) => ({ project, followUp })))
        .sort((a, b) => (a.followUp.due || "9999").localeCompare(b.followUp.due || "9999")),
    [projects]
  );
  const dueNow = followUps.filter(({ followUp }) => ["overdue", "today"].includes(dueState(followUp.due))).length;

  const shown = (projects ?? [])
    .filter((p) => filter === "all" || p.status === filter)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const completeFollowUp = (project: TrackedProject, followUp: FollowUp) =>
    void save({
      ...project,
      followUps: project.followUps.map((f) => (f.id === followUp.id ? { ...f, done: !f.done } : f)),
    });

  return (
    <div className="grid gap-6">
      {error && (
        <p className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add a project</CardTitle>
          <CardDescription>Type it in, or pick one you&apos;ve saved in History.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form
            className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              void add(draft.quote, draft.name, draft.customer);
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="new-quote">Quote no.</Label>
              <Input
                id="new-quote"
                placeholder="TTA0160"
                value={draft.quote}
                onChange={(event) => setDraft({ ...draft, quote: event.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-name">Project</Label>
              <Input
                id="new-name"
                placeholder="Westfield Bondi Stage 2"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-customer">Customer</Label>
              <Input
                id="new-customer"
                placeholder="e.g. Climatech NSW Pty Ltd"
                value={draft.customer}
                onChange={(event) => setDraft({ ...draft, customer: event.target.value })}
              />
            </div>
            <Button type="submit" disabled={!draft.name.trim() || busy === "add"}>
              {busy === "add" ? <Loader2 className="animate-spin" /> : <Plus />} Add
            </Button>
          </form>
          {untracked.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              <Label htmlFor="from-history" className="text-sm">
                From History
              </Label>
              <NativeSelect
                id="from-history"
                className="w-auto max-w-full"
                value=""
                disabled={busy === "add"}
                onChange={(event) => {
                  const saved = untracked.find((p) => p.key === event.target.value);
                  // History titles are "TTA0160 Westfield Bondi Stage 2".
                  if (saved) void add(saved.key, saved.title.replace(new RegExp(`^${saved.key}\\s*[-–]?\\s*`, "i"), ""), "");
                }}
              >
                <option value="">Pick a saved project…</option>
                {untracked.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.title}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="text-primary size-4" /> Follow-ups
            {dueNow > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">
                {dueNow} due
              </span>
            )}
          </CardTitle>
          <CardDescription>Everything still open on active and on-hold projects, soonest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {projects === null ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </p>
          ) : followUps.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing to follow up. Add follow-ups inside a project.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {followUps.map(({ project, followUp }) => (
                <li key={`${project.id}/${followUp.id}`} className="flex items-start gap-3 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    aria-label="Done"
                    className="accent-primary mt-0.5 size-4 shrink-0"
                    checked={followUp.done}
                    onChange={() => completeFollowUp(project, followUp)}
                  />
                  <span className={cn("w-28 shrink-0", DUE_STYLE[dueState(followUp.due)])}>{dueLabel(followUp.due)}</span>
                  <div className="min-w-0 flex-1">
                    <p>
                      <Who project={project} followUp={followUp} /> {followUp.what}
                    </p>
                    <button
                      type="button"
                      className="text-primary text-xs hover:underline"
                      onClick={() => {
                        setFilter("all");
                        setOpenId(project.id);
                      }}
                    >
                      {[project.quote, project.name].filter(Boolean).join(" ")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Your projects</h2>
          <div role="tablist" className="bg-muted inline-flex flex-wrap gap-1 rounded-lg p-1">
            {[...PROJECT_STATUSES, { id: "all" as const, label: "All" }].map((status) => {
              const count = (projects ?? []).filter((p) => status.id === "all" || p.status === status.id).length;
              return (
                <button
                  key={status.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === status.id}
                  onClick={() => setFilter(status.id)}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                    filter === status.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {status.label} <span className="text-muted-foreground text-xs font-normal">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
        {projects !== null && shown.length === 0 && (
          <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
            {projects.length === 0 ? "No projects yet. Add your first one above." : "No projects here."}
          </p>
        )}
        {shown.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            open={openId === project.id}
            historyKeys={historyKeys}
            busy={busy === project.id}
            onToggle={() => setOpenId(openId === project.id ? null : project.id)}
            onEdit={edit}
            onSave={(p) => void save(p)}
            onSaveLatest={() => saveLatest(project.id)}
            onRemove={() => void remove(project)}
          />
        ))}
      </section>
    </div>
  );
}

function ProjectCard({
  project,
  open,
  historyKeys,
  busy,
  onToggle,
  onEdit,
  onSave,
  onSaveLatest,
  onRemove,
}: {
  project: TrackedProject;
  open: boolean;
  historyKeys: Set<string>;
  busy: boolean;
  onToggle: () => void;
  onEdit: (project: TrackedProject) => void;
  onSave: (project: TrackedProject) => void;
  /** Saves the project as it is on screen now. */
  onSaveLatest: () => void;
  onRemove: () => void;
}) {
  const { done, total } = progress(project);
  // Its saves in History, under the quote number as it is now.
  const documentsKey = projectKey(project.quote);
  const hasDocuments = !!documentsKey && historyKeys.has(documentsKey);
  const next = openFollowUps(project)[0];
  const [followUp, setFollowUp] = useState<{ who: ContactKind; contactId?: string; what: string; due: string }>({
    who: "Customer",
    what: "",
    due: "",
  });
  const [note, setNote] = useState("");
  const blankContact = { kind: "Customer" as ContactKind, name: "", phone: "", email: "" };
  const [contact, setContact] = useState(blankContact);

  const setStage = (id: StageId, status: StageStatus) =>
    onSave({ ...project, stages: { ...project.stages, [id]: { status, date: today() } } });

  return (
    <Card className="gap-0 py-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="hover:bg-muted/40 grid w-full gap-3 rounded-xl px-5 py-4 text-left transition-colors md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_10rem_auto] md:items-center"
      >
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {project.quote && <span className="text-muted-foreground mr-1.5 font-medium">{project.quote}</span>}
            {project.name}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {project.customer || "No customer yet"}
            {project.contacts[0] &&
              ` · ${[project.contacts[0].name, project.contacts[0].phone].filter(Boolean).join(" ")}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {STAGES.map((stage) => {
            const status = project.stages[stage.id].status;
            return (
              <span
                key={stage.id}
                title={`${stage.label}: ${stageStatusLabel(status)}`}
                className={cn("rounded border px-1.5 py-0.5 text-[10px] font-medium", STAGE_STYLE[status])}
              >
                {stage.label.replace(/ (to|from) .*/, "").replace("Proposal", "Prop.")}
              </span>
            );
          })}
          <span className="text-muted-foreground ml-1 text-xs tabular-nums">
            {done}/{total}
          </span>
        </div>
        <div className="text-xs">
          {next ? (
            <>
              <p className={DUE_STYLE[dueState(next.due)]}>{dueLabel(next.due)}</p>
              <p className="text-muted-foreground truncate">
                {contactOf(project, next)?.name || next.who}: {next.what}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">No follow-up</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLE[project.status])}>
            {statusLabel(project.status)}
          </span>
          <ChevronDown className={cn("text-muted-foreground size-4 transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <CardContent className="grid gap-6 border-t px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)_9rem]">
            <div className="grid gap-1.5">
              <Label htmlFor={`${project.id}-quote`}>Quote no.</Label>
              <Input
                id={`${project.id}-quote`}
                value={project.quote}
                onChange={(event) => onEdit({ ...project, quote: event.target.value })}
                onBlur={onSaveLatest}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${project.id}-name`}>Project</Label>
              <Input
                id={`${project.id}-name`}
                value={project.name}
                onChange={(event) => onEdit({ ...project, name: event.target.value })}
                onBlur={onSaveLatest}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${project.id}-customer`}>Customer</Label>
              <Input
                id={`${project.id}-customer`}
                value={project.customer}
                onChange={(event) => onEdit({ ...project, customer: event.target.value })}
                onBlur={onSaveLatest}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${project.id}-status`}>Status</Label>
              <NativeSelect
                id={`${project.id}-status`}
                value={project.status}
                onChange={(event) => onSave({ ...project, status: event.target.value as ProjectStatus })}
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-semibold">Documents and steps</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {STAGES.map((stage) => {
                const { status, date } = project.stages[stage.id];
                return (
                  <div key={stage.id} className={cn("grid gap-1.5 rounded-lg border p-3", STAGE_STYLE[status].replace("line-through", ""))}>
                    <Label htmlFor={`${project.id}-${stage.id}`} className="text-foreground text-sm">
                      {stage.label}
                    </Label>
                    <NativeSelect
                      id={`${project.id}-${stage.id}`}
                      className="bg-background text-foreground h-8"
                      value={status}
                      onChange={(event) => setStage(stage.id, event.target.value as StageStatus)}
                    >
                      {STAGE_STATUSES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </NativeSelect>
                    {date && (
                      <p className="text-muted-foreground text-[11px]">
                        Updated {dateFormat.format(new Date(`${date}T00:00:00`))}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-semibold">Contacts</p>
            <form
              className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_10rem_minmax(0,1fr)_auto] sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                if (!contact.name.trim()) return;
                const added: Contact = {
                  id: newId(),
                  kind: contact.kind,
                  name: contact.name.trim(),
                  phone: contact.phone.trim(),
                  email: contact.email.trim(),
                };
                onSave({ ...project, contacts: [...project.contacts, added] });
                setContact({ ...blankContact, kind: contact.kind });
              }}
            >
              <NativeSelect
                aria-label="Role"
                value={contact.kind}
                onChange={(event) => setContact({ ...contact, kind: event.target.value as ContactKind })}
              >
                {CONTACT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </NativeSelect>
              <Input
                aria-label="Name"
                placeholder="Name, e.g. Aaron Hughes"
                value={contact.name}
                onChange={(event) => setContact({ ...contact, name: event.target.value })}
              />
              <Input
                aria-label="Phone"
                type="tel"
                placeholder="Phone"
                value={contact.phone}
                onChange={(event) => setContact({ ...contact, phone: event.target.value })}
              />
              <Input
                aria-label="Email"
                type="email"
                placeholder="Email (optional)"
                value={contact.email}
                onChange={(event) => setContact({ ...contact, email: event.target.value })}
              />
              <Button type="submit" variant="outline" disabled={!contact.name.trim()}>
                <Plus /> Add
              </Button>
            </form>
            {project.contacts.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {project.contacts.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{c.name}</span>{" "}
                      <span className="text-muted-foreground text-xs">{c.kind}</span>
                    </span>
                    {c.phone && (
                      <a href={telLink(c.phone)} className="text-primary inline-flex items-center gap-1 hover:underline">
                        <Phone className="size-3.5" /> {c.phone}
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="text-primary inline-flex items-center gap-1 hover:underline">
                        <Mail className="size-3.5" /> {c.email}
                      </a>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={`Delete ${c.name}`}
                      onClick={() => onSave({ ...project, contacts: project.contacts.filter((x) => x.id !== c.id) })}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-semibold">Follow-ups</p>
            <form
              className="grid gap-2 sm:grid-cols-[13rem_minmax(0,1fr)_10rem_auto] sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                if (!followUp.what.trim()) return;
                onSave({
                  ...project,
                  followUps: [...project.followUps, { id: newId(), ...followUp, what: followUp.what.trim(), done: false }],
                });
                setFollowUp({ ...followUp, what: "", due: "" });
              }}
            >
              <NativeSelect
                aria-label="Who"
                value={followUp.contactId ? `contact:${followUp.contactId}` : followUp.who}
                onChange={(event) => {
                  const picked = project.contacts.find((c) => `contact:${c.id}` === event.target.value);
                  setFollowUp(
                    picked
                      ? { ...followUp, who: picked.kind, contactId: picked.id }
                      : { ...followUp, who: event.target.value as ContactKind, contactId: undefined }
                  );
                }}
              >
                {project.contacts.length > 0 && (
                  <optgroup label="Contacts">
                    {project.contacts.map((c) => (
                      <option key={c.id} value={`contact:${c.id}`}>
                        {c.name} ({c.kind})
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Anyone">
                  {CONTACT_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </optgroup>
              </NativeSelect>
              <Input
                aria-label="What to follow up"
                placeholder="e.g. Chase feedback on the revised offer"
                value={followUp.what}
                onChange={(event) => setFollowUp({ ...followUp, what: event.target.value })}
              />
              <Input
                aria-label="Due"
                type="date"
                value={followUp.due}
                onChange={(event) => setFollowUp({ ...followUp, due: event.target.value })}
              />
              <Button type="submit" variant="outline" disabled={!followUp.what.trim()}>
                <Plus /> Add
              </Button>
            </form>
            {project.followUps.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {[...project.followUps]
                  .sort((a, b) => Number(a.done) - Number(b.done) || (a.due || "9999").localeCompare(b.due || "9999"))
                  .map((f) => (
                    <li key={f.id} className={cn("flex items-center gap-3 px-3 py-2 text-sm", f.done && "opacity-60")}>
                      <input
                        type="checkbox"
                        aria-label="Done"
                        className="accent-primary size-4 shrink-0"
                        checked={f.done}
                        onChange={() =>
                          onSave({
                            ...project,
                            followUps: project.followUps.map((x) => (x.id === f.id ? { ...x, done: !x.done } : x)),
                          })
                        }
                      />
                      <span className={cn("w-28 shrink-0", f.done ? "text-muted-foreground" : DUE_STYLE[dueState(f.due)])}>
                        {f.done ? "Done" : dueLabel(f.due)}
                      </span>
                      <span className={cn("min-w-0 flex-1", f.done && "line-through")}>
                        <Who project={project} followUp={f} /> {f.what}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="Delete follow-up"
                        onClick={() => onSave({ ...project, followUps: project.followUps.filter((x) => x.id !== f.id) })}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-semibold">Notes</p>
            <form
              className="grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!note.trim()) return;
                onSave({ ...project, notes: [{ id: newId(), at: new Date().toISOString(), text: note.trim() }, ...project.notes] });
                setNote("");
              }}
            >
              <Textarea
                aria-label="New note"
                placeholder="e.g. Spoke to the installer – site access from 20 Oct"
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <Button type="submit" variant="outline" size="sm" className="justify-self-start" disabled={!note.trim()}>
                <Plus /> Add note
              </Button>
            </form>
            {project.notes.length > 0 && (
              <ul className="grid gap-2">
                {project.notes.map((n) => (
                  <li key={n.id} className="bg-muted/40 group rounded-lg border px-3 py-2 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-muted-foreground text-xs">{dateTimeFormat.format(new Date(n.at))}</p>
                      <button
                        type="button"
                        aria-label="Delete note"
                        className="text-muted-foreground hover:text-foreground opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                        onClick={() => onSave({ ...project, notes: project.notes.filter((x) => x.id !== n.id) })}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{n.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            {hasDocuments ? (
              <Button asChild variant="outline" size="sm">
                <Link href={projectUrl(documentsKey)}>
                  <ExternalLink /> Open its documents
                </Link>
              </Button>
            ) : (
              <p className="text-muted-foreground text-xs">
                No documents saved in History under {project.quote || "this quote no."} yet.
              </p>
            )}
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onRemove}>
              {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Remove project
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/** Who a follow-up is with: the contact's name and phone (tap to call) when one was picked, else the role. */
function Who({ project, followUp }: { project: TrackedProject; followUp: FollowUp }) {
  const contact = contactOf(project, followUp);
  if (!contact) return <span className="text-muted-foreground">{followUp.who}:</span>;
  return (
    <span className="text-muted-foreground">
      {contact.name} ({contact.kind}
      {contact.phone && (
        <>
          ,{" "}
          <a href={telLink(contact.phone)} className="text-primary hover:underline">
            {contact.phone}
          </a>
        </>
      )}
      ):
    </span>
  );
}
