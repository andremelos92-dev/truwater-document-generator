import { resolvedCommercialTowers, towerSpecKey, type CommercialTower, type ProposalData } from "@/lib/proposal";
import { scopeIndex } from "@/lib/scan-fields";
import type { ScanFieldId } from "@/lib/scan-parse";

/**
 * Commercial Proposal boxes a scan didn't fill, so they can be done by hand. Each key keeps the value the box
 * had right after the scan; a box stays marked until its value changes.
 *
 * Keys: "attention", "tower.<index>.<field>", "scope.<index>", "deliveryTime", "containers", "deliverySite".
 */
export type ScanMarks = { fileName: string; boxes: Map<string, string> };

/** Pricing schedule boxes, in the order they appear. */
const TOWER_BOXES: (keyof CommercialTower)[] = [
  "price",
  "quantity",
  "port",
  "equipment",
  "model",
  "cells",
  "flowType",
  "arrangement",
  "flowRate",
  "hotTemperature",
  "coldTemperature",
  "wetBulb",
  "material",
  "driveType",
  "motor",
  "infill",
  "supportBase",
  "basin",
];

const SHARED_BOXES = ["attention", "deliveryTime", "containers", "deliverySite"] as const;

export const towerBox = (index: number, field: keyof CommercialTower) => `tower.${index}.${field}`;
export const scopeBox = (index: number) => `scope.${index}`;

/** A box's current value (spec-linked tower boxes show what the RFQ holds). */
export function commercialBoxValue(data: ProposalData, key: string): string {
  const [kind, a, b] = key.split(".");
  if (kind === "tower") return String(resolvedCommercialTowers(data)[Number(a)]?.[b as keyof CommercialTower] ?? "");
  if (kind === "scope") {
    const item = data.commercial.scope[Number(a)];
    return item ? `${item.material ?? ""}|${item.description}` : "";
  }
  return String(data.commercial[key as (typeof SHARED_BOXES)[number]] ?? "");
}

/** The Commercial box a scanned field fills, if any. */
function boxForField(data: ProposalData, id: ScanFieldId, index: number): string | null {
  if (id === "attention") return "attention";
  if (id === "towerModel") return towerBox(index, "model");
  if (id === "flowType" || id === "equipment" || id === "basin") return towerBox(index, id);
  const scope = scopeIndex(data, id);
  if (scope >= 0) return scopeBox(scope);
  // Spec fields reach the tower boxes linked to them ("Number Of Cells" -> "No. Of Cells").
  const field = TOWER_BOXES.find((f) => towerSpecKey(f) === id);
  return field ? towerBox(index, field) : null;
}

/**
 * Marks after a scan into tower type `index`: that tower's boxes and the shared ones are re-marked, except
 * the ones the scan filled. Marks on other towers from earlier scans are kept.
 */
export function markUnfilled(
  previous: ScanMarks | null,
  data: ProposalData,
  index: number,
  filled: ScanFieldId[],
  fileName: string
): ScanMarks {
  const filledBoxes = new Set(filled.map((id) => boxForField(data, id, index)));
  const keys = [
    ...SHARED_BOXES,
    ...TOWER_BOXES.map((field) => towerBox(index, field)),
    ...data.commercial.scope.flatMap((item, i) => (item.responsibility === "Truwater" ? [scopeBox(i)] : [])),
  ];
  const boxes = new Map(
    [...(previous?.boxes ?? [])].filter(([key]) => key.startsWith("tower.") && !key.startsWith(`tower.${index}.`))
  );
  for (const key of keys) {
    if (!filledBoxes.has(key)) boxes.set(key, commercialBoxValue(data, key));
  }
  return { fileName, boxes };
}

/** Whether a box is still as the scan left it (so it's still marked). */
export function isMarked(marks: ScanMarks | null, data: ProposalData, key: string): boolean {
  return !!marks?.boxes.has(key) && marks.boxes.get(key) === commercialBoxValue(data, key);
}
