import PizZip from "pizzip";

import { projectTitle, type FlowType, type ProposalData } from "@/lib/proposal";

/**
 * The Inquiry Form (AE-F03) spreadsheet: RFQ values plus the inquiry's own choices, written into the cells of
 * the real form (public/templates/inquiry-form.xlsx) so its logo, styles and drop-down lists are kept.
 */

const TEMPLATE_URL = "/templates/inquiry-form.xlsx";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** "Others (Please specify)" choices open a box for the detail, written in column C. */
export const OTHERS = /^others/i;

export type InquiryField = {
  key: InquiryKey;
  label: string;
  /** Cell the value goes in. */
  cell: string;
  /** The form's drop-down list; none = free text. */
  options?: readonly string[];
  /** Column C cell for the detail ("Others" choice, or a note beside the value). */
  noteCell?: string;
  /** Placeholder for the note box. */
  notePlaceholder?: string;
  placeholder?: string;
  multiline?: boolean;
  /** Small box, three to a row (Yes/No choices, names). */
  short?: boolean;
  section: "inquiry" | "replacement";
};

export type InquiryKey =
  | "biddingStatus"
  | "estimatedPo"
  | "newOrRevamp"
  | "clientType"
  | "coverPage"
  | "structureMaterial"
  | "coolingTowerType"
  | "plantType"
  | "salesTeam"
  | "salesInCharge"
  | "performance"
  | "strategy"
  | "origin"
  | "flowPerCell"
  | "cellsChoice"
  | "deliveryTerm"
  | "warranty"
  | "specialTools"
  | "commissioningSpares"
  | "operationSpares"
  | "otherRemarks"
  | "competitor1"
  | "competitor2"
  | "competitor3"
  | "spaceAvailability"
  | "ctLocation"
  | "existingFoundations"
  | "foundationDimensions"
  | "existingModel"
  | "existingDimensions"
  | "application"
  | "existingType"
  | "newType"
  | "replacementNature"
  | "additionalRemarks";

/** Inquiry choices and their column C details ("<key>Note"). Blank auto fields follow the RFQ. */
export type InquiryData = Partial<Record<InquiryKey | `${InquiryKey}Note`, string>>;

const YES_NO_OPTIONAL = ["Yes", "No", "Optional"];
const CT_TYPES = ["Counterflow", "Crossflow", "Close Circuit", "Plume Abatement", "Package", "Natural Draft", "Others (Please Specify)"];

/** The form's rows, top to bottom, with the drop-down lists exactly as the spreadsheet has them. */
export const INQUIRY_FIELDS: InquiryField[] = [
  { key: "biddingStatus", label: "Bidding Status", cell: "B7", options: ["FEED", "EPC Bidding", "Official Bidding"], section: "inquiry" },
  { key: "estimatedPo", label: "Estimated PO within this year", cell: "B8", options: ["Yes", "No"], section: "inquiry" },
  { key: "newOrRevamp", label: "New Tower or Revamp", cell: "B9", options: ["New Tower", "Revamp"], section: "inquiry" },
  { key: "clientType", label: "Client Type", cell: "B10", options: ["EPC", "Owner"], section: "inquiry" },
  { key: "coverPage", label: "Proposal Cover Page", cell: "B11", options: ["Seagull Logo", "Truwater Logo"], section: "inquiry" },
  {
    key: "structureMaterial",
    label: "Structure Material",
    cell: "B15",
    options: ["FRP", "RC", "HDGS", "Others (Please Specify)"],
    noteCell: "C15",
    notePlaceholder: "e.g. SS316",
    section: "inquiry",
  },
  {
    key: "coolingTowerType",
    label: "Cooling Tower Type",
    cell: "B16",
    options: CT_TYPES,
    noteCell: "C16",
    notePlaceholder: "e.g. Materials: FRP panels and structure, HDG mechanical and basin supports, SS304 in wetted areas.",
    section: "inquiry",
  },
  {
    key: "plantType",
    label: "Plant Type",
    cell: "B17",
    options: ["Power Plant", "Chemical Plant", "Sugar Mill", "Paper Mill", "Steel Mill", "Others (Please specify)"],
    noteCell: "C17",
    notePlaceholder: "e.g. Commercial Building, Healthcare",
    section: "inquiry",
  },
  {
    key: "salesTeam",
    label: "Sales Team",
    cell: "B18",
    options: ["Thailand", "Indonesia", "Korea", "Europe", "Malaysia", "China", "Others (Please Specify)"],
    noteCell: "C18",
    notePlaceholder: "e.g. Australia",
    section: "inquiry",
  },
  { key: "salesInCharge", label: "Sales in-charge", cell: "B19", placeholder: "e.g. Craig Alcorn", section: "inquiry" },
  {
    key: "performance",
    label: "Cooling Tower Performance",
    cell: "B20",
    options: ["AE’s Default", "Others (Please specify)"],
    noteCell: "C20",
    section: "inquiry",
  },
  {
    key: "strategy",
    label: "Strategy Priority",
    cell: "B21",
    options: ["Low Cost", "Low Power Consumption", "Area Limitation", "Others (Please specify)"],
    noteCell: "C21",
    section: "inquiry",
  },
  {
    key: "origin",
    label: "Country of Origin Requirement",
    cell: "B22",
    options: [
      "No Restriction",
      "International Brand but can be China made",
      "Non-China Non-India",
      "GPA country only",
      "Others (Please specify)",
    ],
    noteCell: "C22",
    section: "inquiry",
  },
  { key: "flowPerCell", label: "Water Flowrate per cell (m3/h)", cell: "B24", options: ["AE to decide", "Please specify"], section: "inquiry" },
  { key: "cellsChoice", label: "Number of Cell", cell: "B25", options: ["AE to decide", "Please specify"], section: "inquiry" },
  { key: "deliveryTerm", label: "Delivery Term", cell: "B29", placeholder: "e.g. C&F Brisbane Port", section: "inquiry" },
  { key: "warranty", label: "Warranty Period", cell: "B30", multiline: true, section: "inquiry" },
  { key: "specialTools", label: "Special Tools", cell: "B31", options: YES_NO_OPTIONAL, short: true, section: "inquiry" },
  {
    key: "commissioningSpares",
    label: "Commissioning Spare Parts",
    cell: "B32",
    options: YES_NO_OPTIONAL,
    short: true,
    section: "inquiry",
  },
  {
    key: "operationSpares",
    label: "2 Years Operation Spare Parts",
    cell: "B33",
    options: YES_NO_OPTIONAL,
    short: true,
    section: "inquiry",
  },
  { key: "otherRemarks", label: "Other Remarks", cell: "B35", multiline: true, short: true, section: "inquiry" },
  { key: "competitor1", label: "Identified Competitor 1", cell: "B36", short: true, section: "inquiry" },
  { key: "competitor2", label: "Identified Competitor 2", cell: "B37", short: true, section: "inquiry" },
  { key: "competitor3", label: "Identified Competitor 3", cell: "B38", short: true, section: "inquiry" },
  {
    key: "spaceAvailability",
    label: "Space Availability at Site (L x W x H mm, height constraints)",
    cell: "B45",
    section: "replacement",
  },
  {
    key: "ctLocation",
    label: "Cooling Tower Location",
    cell: "B46",
    options: ["Rooftop / Indoors", "Rooftop / Outdoors", "Ground Level / Indoors", "Ground Level / Outdoors", "Others (Please Specify)"],
    noteCell: "C46",
    section: "replacement",
  },
  {
    key: "existingFoundations",
    label: "Existing Foundations at Site (RC plinths, piping, roof, walls, discharge hood)",
    cell: "B47",
    section: "replacement",
  },
  {
    key: "foundationDimensions",
    label: "Dimensions of Existing Foundations at Site",
    cell: "B48",
    noteCell: "C48",
    notePlaceholder: "e.g. TBA",
    section: "replacement",
  },
  { key: "existingModel", label: "Existing Cooling Tower Model", cell: "B49", placeholder: "e.g. RCT2000", section: "replacement" },
  {
    key: "existingDimensions",
    label: "Existing Cooling Tower Dimensions (L x W x H mm)",
    cell: "B50",
    placeholder: "e.g. 3499 x 3499 x 3816",
    noteCell: "C50",
    notePlaceholder: "e.g. Based on the drawing provided.",
    section: "replacement",
  },
  { key: "application", label: "Cooling Tower Application", cell: "B51", placeholder: "e.g. Commercial Building", section: "replacement" },
  { key: "existingType", label: "Existing Cooling Tower Type", cell: "B52", options: CT_TYPES, noteCell: "C52", section: "replacement" },
  { key: "newType", label: "New Proposed Cooling Tower Type", cell: "B53", options: CT_TYPES, noteCell: "C53", section: "replacement" },
  {
    key: "replacementNature",
    label: "Nature of CT Replacement",
    cell: "B54",
    options: ["Partial Replacement (a few units only)", "Full Replacement (all units)", "Others (Please Specify)"],
    noteCell: "C54",
    section: "replacement",
  },
  { key: "additionalRemarks", label: "Additional Remarks", cell: "B55", multiline: true, section: "replacement" },
];

/** Starting choices, as on the forms sent so far. The proposal only stores what's changed from these. */
const INQUIRY_DEFAULTS: InquiryData = {
  biddingStatus: "Official Bidding",
  estimatedPo: "No",
  newOrRevamp: "New Tower",
  clientType: "Owner",
  coverPage: "Truwater Logo",
  plantType: "Others (Please specify)",
  salesTeam: "Others (Please Specify)",
  salesTeamNote: "Australia",
  salesInCharge: "Craig Alcorn",
  performance: "AE’s Default",
  strategy: "Area Limitation",
  origin: "No Restriction",
  flowPerCell: "Please specify",
  cellsChoice: "Please specify",
  warranty:
    "Standard: 12 months from the date of commissioning or 18 months from the delivery of equipment, whichever comes first.",
  specialTools: "No",
  commissioningSpares: "Yes",
  operationSpares: "Yes",
};

/** What the box holds: the typed or chosen value, else the default ("" = follow the RFQ where it can). */
export function inquiryInput(data: ProposalData, key: InquiryKey | `${InquiryKey}Note`): string {
  return data.inquiry?.[key] ?? INQUIRY_DEFAULTS[key] ?? "";
}

const FLOW_TO_CT_TYPE: Record<FlowType, string> = {
  Counterflow: "Counterflow",
  Crossflow: "Crossflow",
  "Closed Circuit": "Close Circuit",
};

/** Fields that follow the RFQ while left blank. */
export function autoInquiryValue(data: ProposalData, key: InquiryKey): string {
  if (key === "coolingTowerType" || key === "newType") return data.flowType ? FLOW_TO_CT_TYPE[data.flowType] : "";
  if (key === "structureMaterial") {
    const material = (data.spec.towerType.trim() || data.spec.casingMaterial.trim()).toUpperCase();
    if (!material) return "";
    if (/FRP/.test(material)) return "FRP";
    if (/HDG|GALV/.test(material)) return "HDGS";
    if (/^RC\b|CONCRETE/.test(material)) return "RC";
    return "Others (Please Specify)";
  }
  return "";
}

/** The Structure Material detail when the RFQ material isn't one of the list (e.g. SS316). */
function autoInquiryNote(data: ProposalData, key: InquiryKey): string {
  if (key === "structureMaterial" && autoInquiryValue(data, key).startsWith("Others")) {
    return data.spec.towerType.trim() || data.spec.casingMaterial.trim();
  }
  return "";
}

export function inquiryValue(data: ProposalData, key: InquiryKey): string {
  return inquiryInput(data, key).trim() || autoInquiryValue(data, key);
}

export function inquiryNote(data: ProposalData, key: InquiryKey): string {
  return inquiryInput(data, `${key}Note`).trim() || (inquiryInput(data, key).trim() ? "" : autoInquiryNote(data, key));
}

const toNumber = (value: string) => {
  const n = Number(value.replace(/[,\s]/g, ""));
  return value.trim() && Number.isFinite(n) ? n : null;
};

/** "2026-09-22" -> Excel's day number, shown as a date by the cell's format. */
function excelDate(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return Math.round((Date.UTC(+match[1], +match[2] - 1, +match[3]) - Date.UTC(1899, 11, 30)) / 86400000);
}

/** RFQ values shown read-only on the Inquiry tab and written to the form. */
export function inquiryFromRfq(data: ProposalData) {
  const litres = toNumber(data.spec.condenserFlowRate);
  const cells = toNumber(data.spec.numberOfCells);
  const total = litres === null ? null : Math.round(litres * 3.6 * 10000) / 10000;
  return {
    total,
    litres: data.spec.condenserFlowRate.trim(),
    cells,
    perCell: total !== null && cells ? Math.round((total / cells) * 10000) / 10000 : null,
  };
}

type CellValue = string | number | null;

/** Every value cell of the form. Cells not listed here are the form's own labels and notes. */
export function inquiryCells(data: ProposalData): Record<string, CellValue> {
  const rfq = inquiryFromRfq(data);
  const cells: Record<string, CellValue> = {
    B2: excelDate(data.date),
    B3: [data.salesmanName.trim(), data.salesmanPhone.trim()].filter(Boolean).join(" "),
    B4: data.salesmanEmail.trim(),
    C4: data.quoteNumber.trim() ? `Quote ${data.quoteNumber.trim()}` : "",
    B12: data.customerDetail.trim(),
    B13: data.projectName.trim(),
    B14: data.projectAddress.trim(),
    B23: rfq.total,
    C23: rfq.litres ? `${rfq.litres} L/s` : "",
    B26: toNumber(data.spec.condInTemp) ?? data.spec.condInTemp.trim(),
    B27: toNumber(data.spec.condOutTemp) ?? data.spec.condOutTemp.trim(),
    B28: toNumber(data.spec.wetBulbTemp) ?? data.spec.wetBulbTemp.trim(),
  };
  for (const field of INQUIRY_FIELDS) {
    cells[field.cell] = inquiryValue(data, field.key);
    if (field.noteCell) cells[field.noteCell] = inquiryNote(data, field.key);
  }
  // With "Please specify", the RFQ's figure goes beside the choice.
  cells.C24 = inquiryValue(data, "flowPerCell") === "Please specify" ? rfq.perCell : "";
  cells.C25 = inquiryValue(data, "cellsChoice") === "Please specify" ? rfq.cells : "";
  return cells;
}

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Writes one cell in place, keeping its style; text is stored inline so the shared strings stay untouched. */
export function setCell(sheet: string, ref: string, value: CellValue): string {
  const pattern = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`);
  const match = pattern.exec(sheet);
  if (!match) throw new Error(`Cell ${ref} not found in the Inquiry Form template`);
  const style = /\ss="\d+"/.exec(match[1])?.[0] ?? "";
  const cell =
    value === null || value === ""
      ? `<c r="${ref}"${style}/>`
      : typeof value === "number"
        ? `<c r="${ref}"${style}><v>${value}</v></c>`
        : `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
  return sheet.slice(0, match.index) + cell + sheet.slice(match.index + match[0].length);
}

/** "TTA0149 275 Kent St Inquiry Form 2026.xlsx", like the forms saved so far. */
function inquiryFileName(data: ProposalData): string {
  const year = /^\d{4}/.exec(data.date)?.[0] ?? String(new Date().getFullYear());
  return `${[projectTitle(data), "Inquiry Form", year].filter(Boolean).join(" ").replace(/[\\/:*?"<>|]/g, "").trim()}.xlsx`;
}

export async function generateInquiry(data: ProposalData): Promise<{ blob: Blob; fileName: string }> {
  const response = await fetch(TEMPLATE_URL);
  if (!response.ok) throw new Error(`Template not found: ${TEMPLATE_URL}`);
  const zip = new PizZip(await response.arrayBuffer());
  const path = "xl/worksheets/sheet1.xml";
  let sheet = zip.file(path)!.asText();
  for (const [ref, value] of Object.entries(inquiryCells(data))) sheet = setCell(sheet, ref, value);
  zip.file(path, sheet);
  return {
    blob: zip.generate({ type: "blob", mimeType: XLSX_MIME, compression: "DEFLATE" }),
    fileName: inquiryFileName(data),
  };
}
