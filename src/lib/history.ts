import { createEmptySpec, createInitialProposal, projectTitle, type ProposalData } from "@/lib/proposal";

/** The three History tabs. */
export const HISTORY_KINDS = [
  { id: "rfq", label: "RFQ" },
  { id: "proposal", label: "Technical Proposal" },
  { id: "commercial", label: "Commercial Proposal" },
] as const;

export type HistoryKind = (typeof HISTORY_KINDS)[number]["id"];

export function isHistoryKind(value: unknown): value is HistoryKind {
  return HISTORY_KINDS.some((kind) => kind.id === value);
}

export type HistoryEntry = {
  id: string;
  kind: HistoryKind;
  title: string;
  savedAt: string; // ISO date
};

/** A saved entry's name, e.g. "TTA0151 Arthur Gorrie Correctional Centre – ELLIS AIR". */
export function historyTitle(data: ProposalData): string {
  const title = [projectTitle(data), data.customerDetail.trim()].filter(Boolean).join(" – ");
  return (title || "Untitled").slice(0, 120);
}

/** Restores saved form data, filling in anything added to the form since it was saved. */
export function restoreProposal(saved: Partial<ProposalData>): ProposalData {
  const initial = createInitialProposal();
  return {
    ...initial,
    ...saved,
    spec: { ...initial.spec, ...saved.spec },
    extraSpecs: (saved.extraSpecs ?? initial.extraSpecs).map((spec) => ({ ...createEmptySpec(), ...spec })),
    commercial: { ...initial.commercial, ...saved.commercial },
  };
}

/** sessionStorage key used to hand a loaded entry from the History page to the Documents form. */
export const LOAD_KEY = "truwater-history-load";
