import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

import {
  formatDate,
  MAX_REVISIONS,
  PORT_DELIVERY,
  projectTitle,
  proposalRecipient,
  referenceNumber,
  resolvedCommercialTowers,
  SIGNATORIES,
  towerSpec,
  towerTotal,
  type CommercialTower,
  type SignatoryId,
  SPEC_ROWS,
  type ProposalData,
  type Revision,
} from "@/lib/proposal";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type TemplateValues = Record<string, string>;

type DocumentTemplate = {
  label: string;
  /** Word file in /public/templates with {placeholders}. */
  templateUrl: string;
  fileName: (data: ProposalData) => string;
  values: (data: ProposalData) => TemplateValues;
};

function rfqValues(data: ProposalData): TemplateValues {
  const title = projectTitle(data);
  return {
    documentTitle: [title, data.customerDetail.trim()].filter(Boolean).join(" "),
    projectTitle: title,
    projectAddress: data.projectAddress,
    quoteNumber: data.quoteNumber,
    date: formatDate(data.date),
    dateQuoteRequired: formatDate(data.dateQuoteRequired),
    customerDetail: data.customerDetail,
    contactName: data.contactName,
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone,
    salesmanName: data.salesmanName,
    salesmanEmail: data.salesmanEmail,
    salesmanPhone: data.salesmanPhone,
    greeting: data.greeting,
    summaryIntro: data.summaryIntro,
    folderLink: data.folderLink.trim(),
    ...Object.fromEntries(SPEC_ROWS.map((row) => [`spec_${row.key}`, data.spec[row.key]])),
  };
}

function revisionValues(revisions: Revision[]): TemplateValues {
  const values: TemplateValues = {};
  for (let row = 1; row <= MAX_REVISIONS; row++) {
    const revision = revisions[row - 1];
    for (const key of Object.keys(revision ?? {}) as (keyof Revision)[]) {
      values[`r${row}_${key}`] = key === "date" ? formatDate(revision[key], ".") : revision[key];
    }
  }
  return values;
}

function technicalProposalValues(data: ProposalData): TemplateValues {
  return {
    projectTitle: projectTitle(data),
    // The cover is addressed to the chosen recipient (customer, regional partner or other).
    customerDetail: proposalRecipient(data),
    modelLine: [`${data.flowType} Model`, data.towerModel.trim()].filter(Boolean).join(" - "),
    referenceNumber: referenceNumber(data),
    ...revisionValues(data.revisions),
  };
}

function fileName(prefix: string, data: ProposalData): string {
  return `${[prefix, projectTitle(data)].join(" ").replace(/[\\/:*?"<>|]/g, "").trim()}.docx`;
}

export const DOCUMENTS = {
  rfq: {
    label: "RFQ",
    templateUrl: "/templates/rfq.docx",
    fileName: (data) => fileName("RFQ", data),
    values: rfqValues,
  },
  proposal: {
    label: "Technical Proposal",
    templateUrl: "/templates/technical-proposal.docx",
    fileName: (data) => fileName("Technical Proposal", data),
    values: technicalProposalValues,
  },
} satisfies Record<string, DocumentTemplate>;

export type DocumentKind = keyof typeof DOCUMENTS | "commercial";

const AUD = new Intl.NumberFormat("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NUMBER = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 });

/** "389449" -> "AUD $ 389,449.00"; anything that isn't a plain number is kept as typed. */
function audPrice(value: string): string {
  const amount = Number(value.replace(/[,\s]/g, ""));
  return value.trim() && Number.isFinite(amount) ? `AUD $ ${AUD.format(amount)}` : value;
}

/** "1600" -> "1,600"; anything that isn't a plain number is kept as typed. */
function rate(value: string): string {
  const amount = Number(value.replace(/[,\s]/g, ""));
  return value.trim() && Number.isFinite(amount) ? NUMBER.format(amount) : value;
}

/** Splits a multi-line field into list items, dropping manual "a)" / "(b)" prefixes (Word numbers them). */
function listItems(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\(?[a-z]\)\s*/i, "").trim())
    .filter(Boolean);
}

/** The number in a plain numeric value ("1,680" -> 1680), or null when it has other text. */
function plainNumber(value: string): number | null {
  const cleaned = value.replace(/[,\s]/g, "");
  return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : null;
}

/** Writes the kilowatt unit properly: "15 kw", "15kw", "15 KW" -> "15 kW". */
function kilowatts(value: string): string {
  return value.replace(/(\d)\s*kw\b/gi, "$1 kW").replace(/\bkw\b/gi, "kW");
}

/**
 * Pricing table values for one tower. Plain numbers typed in the RFQ get the units used in the
 * proposal ("3" -> "3 cells", "73" L/s -> "73 L/s", "35" -> "35.0 °C", "11" -> "3 x 11 kW").
 */
function formatTower(tower: CommercialTower, fans: string) {
  const cells = plainNumber(tower.cells);
  const flow = plainNumber(tower.flowRate);
  const kw = plainNumber(tower.motor);
  const count = plainNumber(fans) ?? cells;
  const temperature = (value: string) => {
    const n = plainNumber(value);
    return n === null ? value : `${n.toFixed(1)} °C`;
  };
  // "FRP" on the RFQ is printed as the full material name.
  const material = /^frp$/i.test(tower.material.trim()) ? "Pultruded FRP" : tower.material;
  // Likewise "PVC" for the fill.
  const infill = /^pvc$/i.test(tower.infill.trim()) ? "PVC Film Fill" : tower.infill;
  return {
    ...tower,
    material,
    infill,
    cells: cells === null ? tower.cells : `${cells} ${cells === 1 ? "cell" : "cells"}`,
    // Exactly as typed on the RFQ; plain numbers just get their unit.
    flowRate: flow === null ? tower.flowRate : `${tower.flowRate.trim()} L/s`,
    hotTemperature: temperature(tower.hotTemperature),
    coldTemperature: temperature(tower.coldTemperature),
    wetBulb: temperature(tower.wetBulb),
    motor: kw === null ? kilowatts(tower.motor) : count ? `${count} x ${NUMBER.format(kw)} kW` : `${NUMBER.format(kw)} kW`,
    supportBase: tower.supportBase.trim() || material,
    basin: tower.basin.trim() || material,
    price: audPrice(tower.price),
    quantity: tower.quantity.trim() || "1",
    total: audPrice(towerTotal(tower)),
  };
}

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/**
 * "Base Cooling Tower Price basis shall be delivered to site at <site>, from <port> Port to <address> in CKD …
 * four (4) containers …". Sydney, Brisbane and Fremantle have a default site and address; a typed site replaces the name.
 */
function priceBasis(data: ProposalData, port: string): string {
  const delivery = PORT_DELIVERY[port.trim()];
  const site = data.commercial.deliverySite.trim() || delivery?.site || data.projectAddress.trim();
  const count = plainNumber(data.commercial.containers);
  const containers =
    count !== null && Number.isInteger(count) && count <= 10 ? `${NUMBER_WORDS[count]} (${count})` : data.commercial.containers.trim();
  const route = [`from ${port.trim()} Port`, delivery && `to ${delivery.address}`].filter(Boolean).join(" ");
  return (
    `Base Cooling Tower Price basis shall be delivered to site at ${site}, ${route} ` +
    `in CKD (Complete Knock Down) form in ${containers} ${count === 1 ? "container" : "containers"} by flatbed container truck.`
  );
}

/** Cover letter signature slot: which signature picture to keep, plus name, title and phone. */
function signatureValues(slot: 1 | 2, id: SignatoryId): Record<string, unknown> {
  const person = SIGNATORIES.find((signatory) => signatory.id === id) ?? SIGNATORIES[0];
  return {
    ...Object.fromEntries(SIGNATORIES.map((signatory) => [`sig${slot}_${signatory.id}`, signatory.id === person.id])),
    [`sig${slot}_name`]: person.name,
    [`sig${slot}_title`]: person.title,
    [`sig${slot}_phone`]: person.phone,
  };
}

function commercialValues(data: ProposalData): Record<string, unknown> {
  const c = data.commercial;
  const customer = data.customerDetail.trim();
  const partner = data.recipient === "customer" ? "" : proposalRecipient(data);
  const towers = resolvedCommercialTowers(data);
  const exclusions = listItems(c.exclusions);

  // One pricing schedule page per tower type.
  const pricingPages = towers.map((tower, index) => formatTower(tower, towerSpec(data, index).noOfFans));
  const scheduleValues = Object.fromEntries(
    c.schedule.flatMap((step, index) => [
      [`s${index + 1}_description`, step.description],
      [`s${index + 1}_duration`, step.duration],
    ])
  );

  return {
    // Cover
    projectTitle: projectTitle(data),
    coverParties: [customer, partner].filter(Boolean),
    // Same model line and reference as the Technical Proposal cover.
    coverTowerLines: [[`${data.flowType} Model`, data.towerModel.trim()].filter(Boolean).join(" - ")],
    commercialReference: referenceNumber(data),
    ...revisionValues(c.revisions),
    // Cover letter
    // Same "Addressed To" name as the Technical Proposal cover.
    clientLine: proposalRecipient(data),
    attention: c.attention,
    ...signatureValues(1, c.signature1),
    ...signatureValues(2, c.signature2),
    // Pricing schedule: the template repeats its page for each entry
    flowType: data.flowType,
    pricingPages,
    // Scope of supply
    scope: c.scope.map((item) => ({
      description: [item.material?.trim(), item.description.trim()].filter(Boolean).join(" "),
      truwater: item.responsibility === "Truwater",
      optional: item.responsibility === "Optional",
      purchaser: item.responsibility === "Purchaser",
    })),
    // Optional items
    constructionSpares: listItems(c.constructionSpares),
    specialTools: listItems(c.specialTools),
    recommendedSpares: listItems(c.recommendedSpares),
    travelTerms: c.travelTerms,
    erectionRate: rate(c.erectionRate),
    commissioningRate: rate(c.commissioningRate),
    overtimeWeekdayRate: rate(c.overtimeWeekdayRate),
    overtimeSundayRate: rate(c.overtimeSundayRate),
    overtimeHolidayRate: rate(c.overtimeHolidayRate),
    // Purchaser responsibilities and delivery
    responsibilities: listItems(c.purchaserResponsibilities),
    deliveryNotes: c.deliveryNotes,
    ...scheduleValues,
    deliveryTime: c.deliveryTime,
    // Terms of condition: (a) inclusions, (b) first exclusion, (c) liability, (d)+ remaining exclusions
    priceBasis: priceBasis(data, towers[0]?.port ?? ""),
    priceClauses: [c.priceInclusions.trim(), exclusions[0], c.liability.trim(), ...exclusions.slice(1)].filter(Boolean),
    validity: c.validity,
    paymentAdvance: c.paymentAdvance,
    paymentBalance: c.paymentBalance,
    warranty: c.warranty,
  };
}

const COMMERCIAL_TEMPLATE_URL = "/templates/commercial-proposal.docx";
const commercialFileName = (data: ProposalData) => fileName("Commercial Proposal", data);

/** Fills a Word template's {placeholders}; everything else in the file is kept as-is. */
export async function renderTemplate(
  templateUrl: string,
  values: Record<string, unknown>
): Promise<Blob> {
  const response = await fetch(templateUrl);
  if (!response.ok) throw new Error(`Template not found: ${templateUrl}`);

  const doc = new Docxtemplater(new PizZip(await response.arrayBuffer()), {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });
  doc.render(values);
  return doc.getZip().generate({ type: "blob", mimeType: DOCX_MIME, compression: "DEFLATE" });
}

export async function generateDocument(kind: DocumentKind, data: ProposalData) {
  if (kind === "commercial") {
    return {
      blob: await renderTemplate(COMMERCIAL_TEMPLATE_URL, commercialValues(data)),
      fileName: commercialFileName(data),
    };
  }

  const { templateUrl, values, fileName } = DOCUMENTS[kind];
  return { blob: await renderTemplate(templateUrl, values(data)), fileName: fileName(data) };
}
