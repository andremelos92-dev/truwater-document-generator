import {
  EMPTY_SUMMARY_EXTRA,
  FLOW_TYPES,
  SPEC_ROWS,
  addTowerType,
  towerSpec,
  type FlowType,
  type ProposalData,
  type SpecKey,
} from "@/lib/proposal";
import type { ScanFieldId } from "@/lib/scan-parse";

export type ScanField = {
  id: ScanFieldId;
  label: string;
  group: "project" | "tower";
  /** Choices for fields that only take set values. */
  options?: readonly string[];
};

const SCANNED_SPEC_KEYS: readonly ScanFieldId[] = [
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

/** The review list, in form order: project details first, then the tower type's specification. */
export const SCAN_FIELDS: ScanField[] = [
  { id: "quoteNumber", label: "TTA Quote Number", group: "project" },
  { id: "projectName", label: "Project Name", group: "project" },
  { id: "customerDetail", label: "Customer Detail", group: "project" },
  { id: "contactName", label: "Contact name", group: "project" },
  { id: "contactPhone", label: "Contact phone", group: "project" },
  { id: "contactEmail", label: "Contact email", group: "project" },
  { id: "towerModel", label: "Model", group: "tower" },
  { id: "equipment", label: "Equipment No. (Commercial)", group: "tower" },
  { id: "flowType", label: "Counterflow / Crossflow / Closed Circuit", group: "tower", options: FLOW_TYPES },
  ...SPEC_ROWS.filter((row) => (SCANNED_SPEC_KEYS as readonly string[]).includes(row.key)).map(
    (row): ScanField => ({ id: row.key as ScanFieldId, label: row.label, group: "tower" })
  ),
  { id: "shape", label: "Shape (Selection Summary)", group: "tower", options: ["Square", "Rectangular", "Round"] },
  { id: "ctiCertified", label: "CTI Certified (Selection Summary)", group: "tower", options: ["Yes", "No"] },
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
    case "towerModel":
      return index === 0 ? data.towerModel : (tower?.model ?? "");
    case "flowType":
      return index === 0 ? data.flowType : (tower?.flowType ?? "");
    case "equipment":
      return tower?.equipment ?? "";
    case "shape":
      return extra?.shape ?? "";
    case "ctiCertified":
      return extra?.ctiCertified === undefined ? "" : extra.ctiCertified ? "Yes" : "No";
    default:
      return isSpecKey(id) ? towerSpec(data, index)[id] : "";
  }
}

/** Fills the chosen values into tower type `target` (or a new tower type) and the project details. */
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
  const summary = Array.from({ length: Math.max(next.selectionSummary.length, index + 1) }, (_, i) => next.selectionSummary[i]);
  const extra = { ...EMPTY_SUMMARY_EXTRA, ...summary[index] };
  const top: Partial<ProposalData> = {};

  for (const [id, raw] of Object.entries(values) as [ScanFieldId, string][]) {
    const value = raw.trim();
    if (!value) continue;
    if (isSpecKey(id)) spec[id] = value;
    else if (id === "towerModel") {
      if (index === 0) top.towerModel = value;
      else tower.model = value;
    } else if (id === "flowType") {
      if (!(FLOW_TYPES as readonly string[]).includes(value)) continue;
      if (index === 0) top.flowType = value as FlowType;
      else tower.flowType = value as FlowType;
    } else if (id === "equipment") tower.equipment = value;
    else if (id === "shape") extra.shape = value;
    else if (id === "ctiCertified") extra.ctiCertified = value === "Yes";
    else top[id] = value;
  }

  towers[index] = tower;
  summary[index] = extra;
  next = {
    ...next,
    ...top,
    commercial: { ...next.commercial, towers },
    selectionSummary: summary.map((item) => item ?? EMPTY_SUMMARY_EXTRA),
  };
  return index === 0
    ? { ...next, spec }
    : { ...next, extraSpecs: next.extraSpecs.map((s, i) => (i === index - 1 ? spec : s)) };
}
