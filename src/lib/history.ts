import { createEmptySpec, createInitialProposal, projectTitle, type ProposalData } from "@/lib/proposal";

/** A saved project (one per TTA quote number) as History lists it: its latest name and save, and how many saves. */
export type ProjectSummary = {
  key: string;
  title: string;
  savedAt: string; // ISO date of the latest save
  versions: number;
};

/** One save of a project: the whole form (RFQ, Technical, Commercial and Inquiry) and what changed since the save before. */
export type ProjectVersion = {
  id: string;
  title: string;
  savedAt: string; // ISO date
  changes: string[];
};

/** Where a project opens in the browser: its latest save, or one version. */
export function projectUrl(key: string, version?: string): string {
  return `/documents?project=${encodeURIComponent(key)}${version ? `&version=${encodeURIComponent(version)}` : ""}`;
}

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
