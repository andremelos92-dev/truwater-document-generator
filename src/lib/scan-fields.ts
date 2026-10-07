import {
  EMPTY_SUMMARY_EXTRA,
  FLOW_TYPES,
  SPEC_ROWS,
  addTowerType,
  createInitialProposal,
  towerSpec,
  type FlowType,
  type ProposalData,
  type SpecKey,
} from "@/lib/proposal";
import type { ScanFieldId } from "@/lib/scan-parse";

export type ScanField = {
  id: ScanFieldId;
  label: string;
  /** Project details, the chosen tower type, or the Commercial Proposal's Scope of Supply (shared by all towers). */
  group: "project" | "tower" | "scope";
  /** Choices for fields that only take set values. */
  options?: readonly string[];
};

const SCANNED_SPEC_KEYS: readonly ScanFieldId[] = [
  "towerType",
  "casingMaterial",
  "fillMaterial",
  "numberOfCells",
  "airIntakes",
  "kwCapacity",
  "condenserFlowRate",
  "condInTemp",
  "condOutTemp",
  "wetBulbTemp",
  "noOfFans",
  "fanKw",
  "fanDriveType",
  "dimensions",
  "dryWeight",
  "designOperatingWeight",
];

const isSpecKey = (id: ScanFieldId): id is ScanFieldId & SpecKey => SCANNED_SPEC_KEYS.includes(id);

/**
 * Scope of Supply items the scan can fill, found by their description (Truwater items only). Most take a
 * material; the drive and motor lines are descriptions.
 */
const SCOPE_ITEMS: Partial<Record<ScanFieldId, { match: RegExp; part: "material" | "description" }>> = {
  scopeFramework: { match: /^frameworks?$/i, part: "material" },
  scopeBasinSupport: { match: /^cold water basin support/i, part: "material" },
  scopeBoltsWetted: { match: /^bolt(?!.*non-wetted).*wetted/i, part: "material" },
  scopeBoltsNonWetted: { match: /^bolt.*non-wetted/i, part: "material" },
  scopeNozzle: { match: /^spray nozzle/i, part: "material" },
  scopeFill: { match: /^film fill/i, part: "material" },
  scopeDrift: { match: /^drift eliminator/i, part: "material" },
  scopeFanCylinder: { match: /^fan cylinder/i, part: "material" },
  scopeFanBlades: { match: /^fan blade/i, part: "material" },
  scopeDrive: { match: /drive system$/i, part: "description" },
  scopeMotor: { match: /\bphase\b/i, part: "description" },
};

/** The Scope of Supply row a scanned field fills, or -1. */
export function scopeIndex(data: ProposalData, id: ScanFieldId): number {
  const item = SCOPE_ITEMS[id];
  return item
    ? data.commercial.scope.findIndex((s) => s.responsibility === "Truwater" && item.match.test(s.description.trim()))
    : -1;
}

/** The review list, in form order: project details, the tower type's specification, then the Scope of Supply. */
export const SCAN_FIELDS: ScanField[] = [
  { id: "quoteNumber", label: "TTA Quote Number", group: "project" },
  { id: "projectName", label: "Project Name", group: "project" },
  { id: "customerDetail", label: "Customer Detail", group: "project" },
  { id: "contactName", label: "Contact name", group: "project" },
  { id: "contactPhone", label: "Contact phone", group: "project" },
  { id: "contactEmail", label: "Contact email", group: "project" },
  { id: "attention", label: "ATTN. (Commercial cover)", group: "project" },
  { id: "towerModel", label: "Model", group: "tower" },
  { id: "equipment", label: "Equipment No. (Commercial)", group: "tower" },
  { id: "flowType", label: "Counterflow / Crossflow / Closed Circuit", group: "tower", options: FLOW_TYPES },
  ...SPEC_ROWS.filter((row) => (SCANNED_SPEC_KEYS as readonly string[]).includes(row.key)).map(
    (row): ScanField => ({ id: row.key as ScanFieldId, label: row.label, group: "tower" })
  ),
  { id: "basin", label: "Cold Water Basin (Commercial)", group: "tower" },
  { id: "shape", label: "Shape (Selection Summary)", group: "tower", options: ["Square", "Rectangular", "Round"] },
  { id: "ctiCertified", label: "CTI Certified (Selection Summary)", group: "tower", options: ["Yes", "No"] },
  { id: "scopeFramework", label: "Frameworks", group: "scope" },
  { id: "scopeBasinSupport", label: "Cold Water Basin Supporting Framework", group: "scope" },
  { id: "scopeBoltsWetted", label: "Bolt & Nut & Hardware’s Wetted Parts", group: "scope" },
  { id: "scopeBoltsNonWetted", label: "Bolt & Nut & Hardware’s Non-wetted Parts", group: "scope" },
  { id: "scopeNozzle", label: "Spray nozzle", group: "scope" },
  { id: "scopeFill", label: "Film Fill", group: "scope" },
  { id: "scopeDrift", label: "Drift Eliminators", group: "scope" },
  { id: "scopeFanCylinder", label: "Fan Cylinders", group: "scope" },
  { id: "scopeFanBlades", label: "Fan Blades", group: "scope" },
  { id: "scopeDrive", label: "Drive line", group: "scope" },
  { id: "scopeMotor", label: "Motor line", group: "scope" },
];

/** What the form holds now for a field, for tower type `index`. */
export function currentScanValue(data: ProposalData, id: ScanFieldId, index: number): string {
  const tower = data.commercial.towers[index];
  const extra = data.selectionSummary[index];
  switch (id) {
    case "quoteNumber":
    case "projectName":
    case "customerDetail":
    case "contactName":
    case "contactPhone":
    case "contactEmail":
      return data[id];
    case "attention":
      return data.commercial.attention;
    case "towerModel":
      return index === 0 ? data.towerModel : (tower?.model ?? "");
    case "flowType":
      return index === 0 ? data.flowType : (tower?.flowType ?? "");
    case "equipment":
      return tower?.equipment ?? "";
    case "basin":
      return tower?.basin ?? "";
    case "shape":
      return extra?.shape ?? "";
    case "ctiCertified":
      return extra?.ctiCertified === undefined ? "" : extra.ctiCertified ? "Yes" : "No";
    default: {
      if (isSpecKey(id)) return towerSpec(data, index)[id];
      const item = data.commercial.scope[scopeIndex(data, id)];
      if (!item) return "";
      return SCOPE_ITEMS[id]?.part === "description" ? item.description : (item.material ?? "");
    }
  }
}

const INITIAL = createInitialProposal();

/** Scanned fields stored directly on the proposal. */
const PROJECT_IDS = [
  "quoteNumber",
  "projectName",
  "customerDetail",
  "contactName",
  "contactPhone",
  "contactEmail",
] as const satisfies readonly (ScanFieldId & keyof ProposalData)[];

const isProjectId = (id: ScanFieldId): id is (typeof PROJECT_IDS)[number] =>
  (PROJECT_IDS as readonly string[]).includes(id);

/** True when the field still holds the form's starting value (blank, or a default like the SS316 scope materials). */
export function isUntouched(data: ProposalData, id: ScanFieldId, index: number): boolean {
  const now = currentScanValue(data, id, index).trim();
  return !now || now === currentScanValue(INITIAL, id, 0).trim();
}

/** Whether the scan has somewhere to put this field (the Scope of Supply items can be renamed or removed). */
export function canApply(data: ProposalData, id: ScanFieldId): boolean {
  return !SCOPE_ITEMS[id] || scopeIndex(data, id) >= 0;
}

/** Fills the chosen values into tower type `target` (or a new tower type), the project details and the scope. */
export function applyScan(
  data: ProposalData,
  values: Partial<Record<ScanFieldId, string>>,
  target: number | "new"
): ProposalData {
  let next = target === "new" ? addTowerType(data) : data;
  const index = target === "new" ? next.extraSpecs.length : target;

  const spec = { ...towerSpec(next, index) };
  const towers = [...next.commercial.towers];
  const tower = { ...towers[index] };
  const scope = [...next.commercial.scope];
  const summary = Array.from({ length: Math.max(next.selectionSummary.length, index + 1) }, (_, i) => next.selectionSummary[i]);
  const extra = { ...EMPTY_SUMMARY_EXTRA, ...summary[index] };
  const top: Partial<ProposalData> = {};
  let attention = next.commercial.attention;

  for (const [id, raw] of Object.entries(values) as [ScanFieldId, string][]) {
    const value = raw.trim();
    if (!value) continue;
    const scopeItem = SCOPE_ITEMS[id];
    if (isSpecKey(id)) spec[id] = value;
    else if (scopeItem) {
      const at = scopeIndex(next, id);
      if (at >= 0) scope[at] = { ...scope[at], [scopeItem.part]: value };
    } else if (id === "towerModel") {
      if (index === 0) top.towerModel = value;
      else tower.model = value;
    } else if (id === "flowType") {
      if (!(FLOW_TYPES as readonly string[]).includes(value)) continue;
      if (index === 0) top.flowType = value as FlowType;
      else tower.flowType = value as FlowType;
    } else if (id === "equipment") tower.equipment = value;
    else if (id === "basin") tower.basin = value;
    else if (id === "attention") attention = value;
    else if (id === "shape") extra.shape = value;
    else if (id === "ctiCertified") extra.ctiCertified = value === "Yes";
    else if (isProjectId(id)) top[id] = value;
  }

  towers[index] = tower;
  summary[index] = extra;
  next = {
    ...next,
    ...top,
    commercial: { ...next.commercial, attention, towers, scope },
    selectionSummary: summary.map((item) => item ?? EMPTY_SUMMARY_EXTRA),
  };
  return index === 0
    ? { ...next, spec }
    : { ...next, extraSpecs: next.extraSpecs.map((s, i) => (i === index - 1 ? spec : s)) };
}
