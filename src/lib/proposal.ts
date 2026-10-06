export const SPEC_ROWS = [
  { key: "customerRequires", label: "Customer Requires", unit: "#", example: "e.g. 8" },
  { key: "towerType", label: "Tower Type", unit: "", example: "e.g. FRP, SS309" },
  { key: "casingMaterial", label: "Casing Material", unit: "", example: "e.g. FRP, SS309" },
  { key: "fillMaterial", label: "Fill Material", unit: "", example: "e.g. PVC" },
  { key: "numberOfCells", label: "Number Of Cells", unit: "#", example: "e.g. 1" },
  { key: "kwCapacity", label: "kW Capacity", unit: "kW", example: "e.g. 1,680" },
  { key: "condenserFlowRate", label: "Condenser Flow Rate", unit: "L/s", example: "e.g. 73" },
  { key: "condInTemp", label: "Cond. In Temp", unit: "°C", example: "e.g. 35" },
  { key: "condOutTemp", label: "Cond. Out Temp", unit: "°C", example: "e.g. 29.5" },
  { key: "wetBulbTemp", label: "Wet Bulb Temp", unit: "°C", example: "e.g. 23" },
  { key: "noOfFans", label: "No Of Fans", unit: "#", example: "e.g. 1 per tower" },
  { key: "fanKw", label: "Fan kW", unit: "kW", example: "e.g. 11" },
  { key: "fanDriveType", label: "Fan Drive Type", unit: "", example: "e.g. Direct, Belt" },
  { key: "dimensions", label: "Dimensions", unit: "mm", example: "e.g. 3499 x 3499" },
  { key: "designOperatingWeight", label: "Design Operating Weight", unit: "kg", example: "e.g. 5,700" },
] as const;

export type SpecKey = (typeof SPEC_ROWS)[number]["key"];

export type Revision = {
  rev: string;
  date: string; // yyyy-mm-dd
  status: string;
  preparedBy: string;
  checkedBy: string;
  approvedBy: string;
  remarks: string;
};

export type CommercialTower = {
  /** Counterflow or Crossflow; blank until chosen. Tower 1 always follows the Technical Proposal's tower type. */
  flowType: FlowType | "";
  equipment: string;
  model: string;
  cells: string;
  flowRate: string;
  hotTemperature: string;
  coldTemperature: string;
  wetBulb: string;
  material: string;
  driveType: string;
  motor: string;
  infill: string;
  arrangement: string;
  /** Blank = same as the material of construction. */
  supportBase: string;
  /** Blank = same as the material of construction. */
  basin: string;
  /** 1.1 price per unit (AUD). */
  price: string;
  quantity: string;
  /** Port named in 1.2 / 1.3, e.g. "Brisbane" ("C&F Brisbane Port"). */
  port: string;
};

/** 1.2 / 1.3 amount: price x quantity (as a plain number string), or the price if either isn't a number. */
export function towerTotal(tower: Pick<CommercialTower, "price" | "quantity">): string {
  const price = Number(tower.price.replace(/[,\s$]/g, ""));
  const quantity = Number((tower.quantity.trim() || "1").replace(/[,\s]/g, ""));
  return tower.price.trim() && Number.isFinite(price) && Number.isFinite(quantity)
    ? String(Math.round(price * quantity * 100) / 100)
    : tower.price;
}

/** Ports offered for the 1.2 / 1.3 pricing lines; any other port can be typed in. */
export const PORTS = ["Brisbane", "Sydney", "Melbourne", "Adelaide", "Fremantle", "Darwin"] as const;

/** Where goods from a port are delivered in the price basis: the default site name and its address. */
export const PORT_DELIVERY: Partial<Record<string, { site: string; address: string }>> = {
  Sydney: {
    site: "Complete Cooling Towers Service and Spares Pty Ltd",
    address: "Unit 1/3 Jayelem Crescent, Padstow NSW 2211",
  },
  Brisbane: { site: "Cooling Towers Solutions Pty Ltd", address: "1/26 Octal Street, Yatala Qld 4207" },
};

/** Tower fields filled from that tower type's Cooling Tower Specification. */
const TOWER_SPECS: Partial<Record<keyof CommercialTower, SpecKey>> = {
  cells: "numberOfCells",
  flowRate: "condenserFlowRate",
  hotTemperature: "condInTemp",
  coldTemperature: "condOutTemp",
  wetBulb: "wetBulbTemp",
  material: "casingMaterial",
  driveType: "fanDriveType",
  motor: "fanKw",
  infill: "fillMaterial",
};

/** The specification row a tower field is linked to, if any. */
export function towerSpecKey(key: keyof CommercialTower): SpecKey | undefined {
  return TOWER_SPECS[key];
}

/** Most tower types (pricing schedules) one proposal can have. */
export const MAX_TOWER_TYPES = 5;

export function createBlankTower(): CommercialTower {
  return {
    flowType: "",
    equipment: "",
    model: "",
    cells: "",
    flowRate: "",
    hotTemperature: "",
    coldTemperature: "",
    wetBulb: "",
    material: "",
    driveType: "",
    motor: "",
    infill: "",
    arrangement: "",
    supportBase: "",
    basin: "",
    quantity: "1",
    port: "Brisbane",
    price: "",
  };
}

export type CommercialScopeItem = {
  /** Printed before the description, e.g. "SS316" + "Frameworks". */
  material?: string;
  /** Suggested materials offered in the material box. */
  materialOptions?: string[];
  description: string;
  responsibility: "Truwater" | "Optional" | "Purchaser";
};

export type CommercialScheduleStep = {
  description: string;
  duration: string;
};

/** People who can sign the Commercial Proposal cover letter (their signatures are in the template). */
export const SIGNATORIES = [
  { id: "craig", name: "Craig Alcorn", title: "Sales & Project Manager", phone: "+(61)0476 202 471" },
  { id: "kenx", name: "Kenx Wong", title: "Sales Director", phone: "(6)012-236 7782" },
  { id: "andre", name: "Andre Santos", title: "Sales & Application Engineer", phone: "+61 (0)420 559 560" },
] as const;

export type SignatoryId = (typeof SIGNATORIES)[number]["id"];

export type CommercialProposalData = {
  /** Cover letter signatures, left and right. */
  signature1: SignatoryId;
  signature2: SignatoryId;
  /** The Commercial Proposal cover's own revision table (separate from the Technical Proposal). */
  revisions: Revision[];
  /** "ATTN." line on the cover letter. */
  attention: string;
  towers: CommercialTower[];
  scope: CommercialScopeItem[];
  constructionSpares: string;
  specialTools: string;
  recommendedSpares: string;
  erectionRate: string;
  commissioningRate: string;
  overtimeWeekdayRate: string;
  overtimeSundayRate: string;
  overtimeHolidayRate: string;
  travelTerms: string;
  purchaserResponsibilities: string;
  deliveryTime: string;
  deliveryNotes: string;
  schedule: CommercialScheduleStep[];
  /** Price basis: site the towers are delivered to (blank = the project address). */
  deliverySite: string;
  /** Price basis: number of containers, e.g. "2" -> "two (2) container". */
  containers: string;
  priceInclusions: string;
  exclusions: string;
  validity: string;
  paymentAdvance: string;
  paymentBalance: string;
  warranty: string;
  liability: string;
};

/** Material choices for the framework, mechanical, hardware and fan cylinder scope items. */
const STRUCTURAL_MATERIALS = ["FRP", "SS304", "SS316"];

export function createInitialCommercialProposal(): CommercialProposalData {
  return {
    revisions: [
      { ...createRevision("0"), preparedBy: "Craig Alcorn", checkedBy: "Kenx Wong", approvedBy: "WK How" },
    ],
    attention: "",
    signature1: "craig",
    signature2: "kenx",
    towers: [createBlankTower()],
    scope: [
      { material: "SS316", materialOptions: STRUCTURAL_MATERIALS, description: "Frameworks", responsibility: "Truwater" },
      { material: "SS316", materialOptions: STRUCTURAL_MATERIALS, description: "Cold Water Basin Supporting Framework", responsibility: "Truwater" },
      { material: "SS316", materialOptions: STRUCTURAL_MATERIALS, description: "Mechanical", responsibility: "Truwater" },
      { material: "SS316", materialOptions: STRUCTURAL_MATERIALS, description: "Bolt & Nut & Hardware’s Wetted Parts", responsibility: "Truwater" },
      { material: "SS316", materialOptions: STRUCTURAL_MATERIALS, description: "Bolt & Nut & Hardware’s Non-wetted Parts", responsibility: "Truwater" },
      { material: "PP", description: "Spray nozzle", responsibility: "Truwater" },
      { material: "PVC", description: "Film Fill- delivered in loose sheets", responsibility: "Truwater" },
      { material: "PVC", description: "Drift Eliminators", responsibility: "Truwater" },
      { material: "SS316", materialOptions: STRUCTURAL_MATERIALS, description: "Fan Cylinders", responsibility: "Truwater" },
      { material: "Aluminum Alloy", description: "Fan Blades c/w Galvanized Steel Fan Hub", responsibility: "Truwater" },
      { description: "Direct Drive System", responsibility: "Truwater" },
      { description: "Single Speed, IP55 Enclosure, 3 Phase / 50Hz / 400 V", responsibility: "Truwater" },
      { description: "Special tools for erection commissioning", responsibility: "Truwater" },
      { description: "Spare part for erection commissioning", responsibility: "Truwater" },
      { description: "Recommended spare part for 2 years", responsibility: "Optional" },
      { description: "Site Erection Supervision", responsibility: "Optional" },
      { description: "Site Erection work", responsibility: "Optional" },
      { description: "Cable tray c/w support material", responsibility: "Purchaser" },
      { description: "Cabling from motor and junction box", responsibility: "Purchaser" },
      { description: "Earthling of lightning protection system", responsibility: "Purchaser" },
      { description: "Power/control cabling/variable frequency drives/motor control centers etc", responsibility: "Purchaser" },
      { description: "Canopy for motor", responsibility: "Purchaser" },
      { description: "Measuring and monitoring instruments, BAS, bearing temperature sensor etc", responsibility: "Purchaser" },
      { description: "Lighting system", responsibility: "Purchaser" },
      { description: "All Reinforced Concrete works including engineering, cold water basin, water proofing etc.", responsibility: "Purchaser" },
      { description: "Chemical or ozone treatment system", responsibility: "Purchaser" },
      { description: "All external hot water inlets piping riser pipes and accessories", responsibility: "Purchaser" },
    ],
    constructionSpares: "a) 2 blocks of PVC Infill\nb) 2 blocks of PVC Drift Eliminator\nc) 5 pcs of Spray Nozzles",
    specialTools: "a) One (1) pc of Inclinometer for Adjusting Fan Blade Angle\nb) One (1) set Glue Machine",
    recommendedSpares: "a) 3 blocks of PVC Infill\nb) 3 blocks of PVC Drift Eliminator\nc) 5 pcs of Spray Nozzles",
    erectionRate: "1600",
    commissioningRate: "1600",
    overtimeWeekdayRate: "300",
    overtimeSundayRate: "300",
    overtimeHolidayRate: "400",
    travelTerms: "Flight, transportation and accommodation shall be charged separately at cost +15% (for arrangements made by Truwater) or to be provided by Purchaser.",
    purchaserResponsibilities: [
      "Provision of air-conditioned site office and work shed with power and water utilities source.",
      "Provision of lay-down area of approx. 25.0m x 50.0m for the cooling tower parts and components around the vicinity of the cooling tower location.",
      "Maximum distance of utilities source to the working place is not more than 30 m.",
      "Provision of sufficient lighting for evening/night work if necessary.",
      "Foundation construction – Dimensional check, chipping and leveling of foundations.",
      "General security/watch at work site.",
      "Secure storehouse storage for mechanical and loose components.",
      "Sheltered and ventilated storage area for the PVC in-fills and drift eliminators",
    ].join("\n"),
    deliveryTime: "14- 16 Weeks",
    deliveryNotes: "Our preliminary delivery schedule as following and the actual delivery schedule is subject to further discussion to meet contractual requirement if essential.",
    schedule: [
      { description: "Receiving & Processing of PO", duration: "1wk" },
      { description: "Engineering Design Approval", duration: "1-2wk" },
      { description: "Procurement of Buy Out Materials", duration: "1-2wk" },
      { description: "Manufacturing & Production", duration: "5-6wk" },
      { description: "Inspection & Packing", duration: "1wk" },
      { description: "Packing and Logistic FOB", duration: "1wk" },
    ],
    deliverySite: "",
    containers: "2",
    priceInclusions: "All prices quoted Include Custom Clearance, Import duties.",
    exclusions: "(b) Price is exclusive of GST.\n(d) No Allowance for unloading containers is included within this quotation.\n(e) No Allowance for building cooling towers is included within this quotation.\n(f) No Allowance for delivery to work site is included within this quotation.",
    validity: "Thirty (30) days from the date of Proposal",
    paymentAdvance: "30% Advance payment upon confirmation of Purchase Order",
    paymentBalance: "70% On delivery to site. Thirty (30) days from the Invoice.",
    warranty: "The warranty against manufacturing defects shall be Twelve (12) month from the date of delivery. Our warranty is subject to conditions that the cooling tower is installed, operated and maintained in accordance with our recommendations.",
    liability: "We accept no liability for the consequential, indirect, or other special damages. Nor are we liable for any loss or damage resulting from delays in delivery caused by conditions which are beyond our control.",
  };
}

export type ProposalData = {
  projectName: string;
  projectAddress: string;
  quoteNumber: string;
  date: string; // yyyy-mm-dd (from <input type="date">)
  dateQuoteRequired: string; // yyyy-mm-dd, or "ASAP"
  customerDetail: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  salesmanName: string;
  salesmanEmail: string;
  salesmanPhone: string;
  greeting: string;
  summaryIntro: string;
  folderLink: string;
  /** Tower type 1 specification (also used by the RFQ). */
  spec: Record<SpecKey, string>;
  /** Specifications for tower types 2, 3… (each gets its own pricing schedule). */
  extraSpecs: Record<SpecKey, string>[];
  flowType: FlowType | "";
  towerModel: string;
  recipient: Recipient;
  otherRecipient: string;
  revisions: Revision[];
  commercial: CommercialProposalData;
};

type TowerSource = Pick<ProposalData, "commercial" | "towerModel" | "flowType" | "spec" | "extraSpecs">;

/** The specification of tower type `index` (0 = the RFQ's own specification). */
export function towerSpec(data: Pick<ProposalData, "spec" | "extraSpecs">, index: number) {
  return index === 0 ? data.spec : (data.extraSpecs[index - 1] ?? createEmptySpec());
}

export function resolvedCommercialTowers(data: TowerSource) {
  // Spec-linked fields always come from the specification; they aren't edited on the Commercial tab.
  return data.commercial.towers.map((tower, index) => {
    const spec = towerSpec(data, index);
    const resolved = { ...tower };
    for (const key of Object.keys(tower) as (keyof CommercialTower)[]) {
      const specKey = towerSpecKey(key);
      // Spec-linked fields are all text fields.
      if (specKey) (resolved as Record<string, string>)[key] = spec[specKey].trim();
    }
    if (index === 0) {
      // Tower 1's model is always the Technical Proposal cover's Model.
      resolved.model = data.towerModel.trim();
      resolved.flowType = data.flowType;
    }
    return resolved;
  });
}

/** Adds a tower type: a blank specification plus its Commercial Proposal tower. */
export function addTowerType<T extends Pick<ProposalData, "extraSpecs" | "commercial">>(data: T): T {
  return {
    ...data,
    extraSpecs: [...data.extraSpecs, createEmptySpec()],
    commercial: { ...data.commercial, towers: [...data.commercial.towers, createBlankTower()] },
  };
}

/** Removes tower type `index` (1 or more) with its Commercial Proposal tower. */
export function removeTowerType<T extends Pick<ProposalData, "extraSpecs" | "commercial">>(data: T, index: number): T {
  return {
    ...data,
    extraSpecs: data.extraSpecs.filter((_, i) => i !== index - 1),
    commercial: { ...data.commercial, towers: data.commercial.towers.filter((_, i) => i !== index) },
  };
}

/**
 * Companies a Technical Proposal can be addressed to instead of the end customer.
 * Add a region here (e.g. Victoria, Darwin) and it appears as an option on the form.
 */
export const PARTNERS = [
  { id: "sydney", region: "Sydney", name: "Complete Cooling Towers Service and Spares Pty Ltd" },
  { id: "queensland", region: "Queensland", name: "Cooling Tower Solutions" },
] as const;

/** "customer" copies Customer Detail, "other" uses the typed name, otherwise a partner id. */
export type Recipient = "customer" | "other" | (typeof PARTNERS)[number]["id"];

export const FLOW_TYPES = ["Counterflow", "Crossflow"] as const;
export type FlowType = (typeof FLOW_TYPES)[number];

/** The Technical Proposal revision table has this many rows. */
export const MAX_REVISIONS = 5;

/** Names offered in the revision table's sign-off columns. Add a name here to offer it. */
export const REVISION_PEOPLE = {
  preparedBy: ["Andre Santos", "Craig Alcorn"],
  checkedBy: ["Craig Alcorn", "Kenx Wong"],
  approvedBy: ["Kenx Wong", "WK How"],
} as const satisfies Partial<Record<keyof Revision, readonly string[]>>;

export function createRevision(rev: string): Revision {
  return {
    rev,
    date: today(),
    status: rev === "0" ? "Initial Bid" : "",
    preparedBy: "Andre Santos",
    checkedBy: "Craig Alcorn",
    approvedBy: "Kenx Wong",
    remarks: "",
  };
}

/** Today's date as yyyy-mm-dd in the user's local time zone (not UTC). */
function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function createEmptySpec(): Record<SpecKey, string> {
  return Object.fromEntries(SPEC_ROWS.map((row) => [row.key, ""])) as Record<SpecKey, string>;
}

export function createInitialProposal(): ProposalData {
  return {
    projectName: "",
    projectAddress: "",
    quoteNumber: "",
    date: today(),
    dateQuoteRequired: "",
    customerDetail: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    salesmanName: "Andre Santos",
    salesmanEmail: "andre.santos@truwater.net.au",
    salesmanPhone: "0420 559 560",
    greeting: "Dear Engineers,",
    summaryIntro: "Please find my Summary",
    folderLink: "",
    spec: createEmptySpec(),
    extraSpecs: [],
    flowType: "",
    towerModel: "",
    recipient: "customer",
    otherRecipient: "",
    revisions: [createRevision("0")],
    commercial: createInitialCommercialProposal(),
  };
}

/** "2026-09-26" -> "26/09/2026" (Australian format), or "26.09.2026" with separator ".". */
export function formatDate(value: string, separator = "/"): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? [match[3], match[2], match[1]].join(separator) : value;
}

/** "TTA0149" + "275 Kent St" -> "TTA0149 275 Kent St" (unless the name already starts with the quote number). */
export function projectTitle(data: Pick<ProposalData, "quoteNumber" | "projectName">): string {
  const quote = data.quoteNumber.trim();
  const name = data.projectName.trim();
  if (!quote || name.toUpperCase().startsWith(quote.toUpperCase())) return name;
  return [quote, name].filter(Boolean).join(" ");
}

/** The company name printed on the Technical Proposal cover. */
export function proposalRecipient(
  data: Pick<ProposalData, "recipient" | "otherRecipient" | "customerDetail">
): string {
  if (data.recipient === "customer") return data.customerDetail.trim();
  if (data.recipient === "other") return data.otherRecipient.trim();
  return PARTNERS.find((partner) => partner.id === data.recipient)?.name ?? "";
}

/** "TTA0146" dated 2026 -> "TTA/0146/2026". */
export function referenceNumber(data: Pick<ProposalData, "quoteNumber" | "date">): string {
  const year = /^\d{4}/.exec(data.date)?.[0] ?? String(new Date().getFullYear());
  const match = /^([A-Za-z]+)\s*(\d+)$/.exec(data.quoteNumber.trim());
  return match ? `${match[1].toUpperCase()}/${match[2]}/${year}` : data.quoteNumber;
}
