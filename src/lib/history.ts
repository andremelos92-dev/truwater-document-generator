import { createEmptySpec, createInitialProposal, projectTitle, type ProposalData } from "@/lib/proposal";

/** A saved project: the whole form (RFQ, Technical, Commercial and Inquiry), the latest save per TTA quote number. */
export type ProjectEntry = {
  id: string;
  title: string;
  savedAt: string; // ISO date
};

/** "tta 0160" -> "TTA0160": the quote number a project is saved under, or "" when there isn't one. */
export function projectKey(quoteNumber: string): string {
  return quoteNumber.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** A saved project's name, e.g. "TTA0160 Westfield Bondi Stage 2". */
export function historyTitle(data: ProposalData): string {
  return (projectTitle(data) || "Untitled").slice(0, 120);
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

/** sessionStorage key used to hand a loaded project from the History page to the Documents form. */
export const LOAD_KEY = "truwater-history-load";
