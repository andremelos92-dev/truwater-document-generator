/**
 * Project tracker (master account only): where each project is up to – which documents are done, who to follow up
 * and when – kept apart from the document History.
 */

/** The documents and steps of a project, in the order they usually happen. */
export const STAGES = [
  { id: "rfq", label: "RFQ to engineering" },
  { id: "selection", label: "Selection from engineering" },
  { id: "technical", label: "Technical Proposal" },
  { id: "commercial", label: "Commercial Proposal" },
  { id: "inquiry", label: "Inquiry Form" },
  { id: "sent", label: "Sent to customer" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export const STAGE_STATUSES = [
  { id: "todo", label: "Not started" },
  { id: "doing", label: "In progress" },
  { id: "review", label: "To review" },
  { id: "done", label: "Done" },
  { id: "na", label: "N/A" },
] as const;

export type StageStatus = (typeof STAGE_STATUSES)[number]["id"];

export const PROJECT_STATUSES = [
  { id: "active", label: "Active" },
  { id: "onHold", label: "On hold" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]["id"];

export const CONTACT_KINDS = ["Customer", "Installer", "Engineering", "Other"] as const;

export type ContactKind = (typeof CONTACT_KINDS)[number];

export type Stage = {
  status: StageStatus;
  /** When it was last changed (YYYY-MM-DD). */
  date: string;
};

export type FollowUp = {
  id: string;
  who: ContactKind;
  /** e.g. "Call Aaron about the revised offer". */
  what: string;
  /** Due date (YYYY-MM-DD), or "" for no date. */
  due: string;
  done: boolean;
};

export type Note = { id: string; at: string; text: string };

export type TrackedProject = {
  /** The History key when there's a quote number ("TTA0160"), so the project links to its documents. */
  id: string;
  quote: string;
  name: string;
  customer: string;
  status: ProjectStatus;
  stages: Record<StageId, Stage>;
  followUps: FollowUp[];
  /** Newest first. */
  notes: Note[];
  createdAt: string;
  updatedAt: string;
};

export const isSafeTrackerId = (id: string) => /^[A-Za-z0-9-]{1,60}$/.test(id);

/** Today in the browser's time zone, as YYYY-MM-DD. */
export function today(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export const newId = () => Math.random().toString(36).slice(2, 10);

export function createProject(quote: string, name: string, customer: string, id: string): TrackedProject {
  const now = new Date().toISOString();
  return {
    id,
    quote: quote.trim(),
    name: name.trim(),
    customer: customer.trim(),
    status: "active",
    stages: Object.fromEntries(STAGES.map((s) => [s.id, { status: "todo", date: "" }])) as Record<StageId, Stage>,
    followUps: [],
    notes: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Fills in anything added to the tracker since a project was saved. */
export function restoreProject(saved: TrackedProject): TrackedProject {
  const blank = createProject(saved.quote ?? "", saved.name ?? "", saved.customer ?? "", saved.id);
  return { ...blank, ...saved, stages: { ...blank.stages, ...saved.stages } };
}

/** Done (or not needed) out of all the stages. */
export function progress(project: TrackedProject): { done: number; total: number } {
  const stages = STAGES.map((s) => project.stages[s.id].status);
  const counted = stages.filter((s) => s !== "na");
  return { done: counted.filter((s) => s === "done").length, total: counted.length };
}

/** Open follow-ups, soonest first (undated last). */
export function openFollowUps(project: TrackedProject): FollowUp[] {
  return project.followUps
    .filter((f) => !f.done)
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
}

/** "overdue", "today" or "later" for a due date; "none" when there isn't one. */
export function dueState(due: string, now = today()): "overdue" | "today" | "later" | "none" {
  if (!due) return "none";
  return due < now ? "overdue" : due === now ? "today" : "later";
}
