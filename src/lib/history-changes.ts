import { INQUIRY_FIELDS } from "@/lib/inquiry";
import {
  proposalRecipient,
  SPEC_ROWS,
  towerFlowType,
  towerModel,
  towerScope,
  towerSpec,
  type CommercialProposalData,
  type CommercialScopeItem,
  type ProposalData,
  type Revision,
} from "@/lib/proposal";

/** Project boxes, in form order. */
const PROJECT_LABELS: [keyof ProposalData, string][] = [
  ["quoteNumber", "TTA Quote Number"],
  ["projectName", "Project Name"],
  ["customerDetail", "Customer Detail"],
  ["projectAddress", "Project Address"],
  ["date", "Date"],
  ["dateQuoteRequired", "Date Quote Required"],
  ["contactName", "Contact name"],
  ["contactEmail", "Contact email"],
  ["contactPhone", "Contact phone"],
  ["salesmanName", "Salesman name"],
  ["salesmanEmail", "Salesman email"],
  ["salesmanPhone", "Salesman phone"],
  ["greeting", "Greeting"],
  ["summaryIntro", "Summary"],
  ["folderLink", "Link To Folder"],
];

/** Commercial tower boxes that aren't filled from the specification or the Technical Proposal. */
const TOWER_LABELS = [
  ["price", "Sales Price"],
  ["quantity", "Quantity"],
  ["port", "Port"],
  ["arrangement", "Arrangement"],
  ["supportBase", "Mech. Support Base"],
  ["basin", "Cold Water Basin"],
] as const;

/** Commercial fields shown under their own name; the rest are named from their key. */
const COMMERCIAL_LABELS: Partial<Record<keyof CommercialProposalData, string>> = {
  attention: "ATTN.",
  signature1: "Signature 1",
  signature2: "Signature 2",
};

/** Read out as a whole, not compared field by field. */
const COMMERCIAL_SKIP = new Set<keyof CommercialProposalData>(["revisions", "towers", "scope", "extraScopes", "schedule"]);

/** "overtimeWeekdayRate" -> "Overtime weekday rate". */
const humanize = (key: string) => key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).replace(/ (\w)/g, (m) => m.toLowerCase());

const revisionText = (r: Revision) =>
  [r.date, r.status, [r.preparedBy, r.checkedBy, r.approvedBy].filter(Boolean).join(" / "), r.remarks]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");

const scopeText = (item: CommercialScopeItem) =>
  `${[item.material?.trim(), item.description.trim()].filter(Boolean).join(" ")} (${item.responsibility})`;

/** Every value the documents use, by a readable name; `tower` marks the tower type it belongs to. */
type Snapshot = Map<string, { label: string; value: string; tower?: number }>;

function snapshot(data: ProposalData): Snapshot {
  const out: Snapshot = new Map();
  const add = (key: string, label: string, value: unknown, tower?: number) =>
    out.set(key, { label, value: String(value ?? "").trim(), tower });

  for (const [field, label] of PROJECT_LABELS) add(field, label, data[field]);
  add("recipient", "Addressed To", proposalRecipient(data));

  const towers = 1 + data.extraSpecs.length;
  for (let i = 0; i < towers; i++) {
    const t = `Tower ${i + 1}`;
    add(`${t}.type`, `${t} Type`, towerFlowType(data, i), i);
    add(`${t}.model`, `${t} Model`, towerModel(data, i), i);
    const spec = towerSpec(data, i);
    for (const row of SPEC_ROWS) add(`${t}.spec.${row.key}`, `${t} ${row.label}`, spec[row.key], i);
    const tower = data.commercial.towers[i];
    for (const [key, label] of TOWER_LABELS) add(`${t}.${key}`, `${t} ${label}`, tower?.[key], i);
    add(`${t}.assembledOption`, `${t} Assembled Option`, tower?.assembledOption ? "Yes" : "No", i);
    if (tower?.assembledOption) add(`${t}.assembledPrice`, `${t} Assembled Sales Price`, tower.assembledPrice, i);
    towerScope(data, i).forEach((item, row) => add(`${t}.scope.${row}`, `${t} Scope of Supply`, scopeText(item), i));
    const extra = data.selectionSummary[i];
    if (extra) {
      add(`${t}.shape`, `${t} Shape (Selection Summary)`, extra.shape, i);
      add(`${t}.cti`, `${t} CTI Certified (Selection Summary)`, extra.ctiCertified ? "Yes" : "No", i);
    }
  }

  data.revisions.forEach((r, i) => add(`tp.rev.${i}`, `Technical Proposal Rev ${r.rev}`, revisionText(r)));
  data.commercial.revisions.forEach((r, i) => add(`cp.rev.${i}`, `Commercial Proposal Rev ${r.rev}`, revisionText(r)));
  data.commercial.schedule.forEach((step, i) =>
    add(`cp.schedule.${i}`, "Delivery schedule", [step.description, step.duration].filter(Boolean).join(" – "))
  );
  for (const key of Object.keys(data.commercial) as (keyof CommercialProposalData)[]) {
    if (COMMERCIAL_SKIP.has(key)) continue;
    add(`cp.${key}`, `Commercial ${COMMERCIAL_LABELS[key] ?? humanize(key)}`, data.commercial[key]);
  }
  for (const field of INQUIRY_FIELDS) {
    add(`inq.${field.key}`, `Inquiry Form ${field.label}`, data.inquiry[field.key]);
    add(`inq.${field.key}Note`, `Inquiry Form ${field.label} (note)`, data.inquiry[`${field.key}Note`]);
  }
  return out;
}

const MAX_VALUE = 60;
const MAX_LINES = 30;

const show = (value: string) => {
  if (!value) return "(blank)";
  const line = value.replace(/\s*\n\s*/g, " / ");
  return `“${line.length > MAX_VALUE ? `${line.slice(0, MAX_VALUE - 1)}…` : line}”`;
};

/**
 * What changed between two saves of a project, one line per change, e.g.
 * "Tower 2 Sales Price: “389449” → “395000”" or "Added Tower Type 2". Empty when nothing changed.
 */
export function describeChanges(before: ProposalData, after: ProposalData): string[] {
  const was = snapshot(before);
  const now = snapshot(after);
  const towersBefore = 1 + before.extraSpecs.length;
  const towersAfter = 1 + after.extraSpecs.length;
  // Boxes of an added or removed tower type are summed up by that one line.
  const shared = Math.min(towersBefore, towersAfter);

  const lines: string[] = [];
  for (let i = towersBefore; i < towersAfter; i++) {
    const name = [towerFlowType(after, i), towerModel(after, i)].filter(Boolean).join(" ");
    lines.push(`Added Tower Type ${i + 1}${name ? ` (${name})` : ""}`);
  }
  for (let i = towersAfter; i < towersBefore; i++) lines.push(`Removed Tower Type ${i + 1}`);

  for (const key of new Set([...was.keys(), ...now.keys()])) {
    const a = was.get(key);
    const b = now.get(key);
    const tower = a?.tower ?? b?.tower;
    if (tower !== undefined && tower >= shared) continue;
    const from = a?.value ?? "";
    const to = b?.value ?? "";
    if (from === to) continue;
    lines.push(`${(b ?? a)!.label}: ${show(from)} → ${show(to)}`);
  }

  return lines.length > MAX_LINES
    ? [...lines.slice(0, MAX_LINES), `…and ${lines.length - MAX_LINES} more changes`]
    : lines;
}
