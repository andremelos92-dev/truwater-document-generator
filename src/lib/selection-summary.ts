import {
  EMPTY_SUMMARY_EXTRA,
  projectTitle,
  resolvedCommercialTowers,
  towerSpec,
  type FlowType,
  type ProposalData,
  type SummaryExtra,
} from "@/lib/proposal";

/** One tower type's block in the Selection Summary email. */
export type SummaryTower = {
  heading: string;
  description: string;
  rows: [label: string, value: string][];
  /** Form fields the table needs that are still blank. */
  missing: string[];
};

export type SelectionSummary = {
  greeting: string;
  /** Printed in bold after "Thank you for the opportunity to provide our proposal for". */
  project: string;
  /** Documents listed under "Please find attached for your review:". */
  attachments: string[];
  /** Email-level fields that are still blank (shown as a warning, not printed). */
  missing: string[];
  towers: SummaryTower[];
  materials: string[];
  closing: string;
};

const FLOW_LABELS: Record<FlowType, string> = {
  Counterflow: "Counter-Flow",
  Crossflow: "Cross-Flow",
  "Closed Circuit": "Closed Circuit",
};

/** Truwater scope items printed under Materials of Construction, in the email's order. */
const SCOPE_MATERIALS: { match: RegExp; label: string }[] = [
  { match: /^frameworks?$/i, label: "Framework Members" },
  { match: /^fan cylinders?$/i, label: "Fan Cylinder" },
  { match: /^cold water basin support/i, label: "Cold Water Basin Support Frames" },
  { match: /^mechanical/i, label: "Mechanical Support" },
  { match: /^bolt(?!.*non-wetted).*wetted/i, label: "Wetted Nuts, Bolts & Washers" },
  { match: /non-wetted/i, label: "Non-Wetted Nuts, Bolts & Washers" },
];

/** Which proposals are attached to the email. */
export type SummaryAttachments = { technical: boolean; commercial: boolean };

const closing = (count: number) =>
  `Please review the attached ${count === 1 ? "proposal" : "proposals"} and feel free to contact me if you have any questions.`;

const isPlainNumber = (value: string) => /^\d[\d,]*(\.\d+)?$/.test(value.trim());

/** "73" -> "73 L/s"; anything already carrying its own unit or words is left as typed. */
const withUnit = (value: string, unit: string) => {
  const trimmed = value.trim();
  return trimmed && isPlainNumber(trimmed) ? `${trimmed} ${unit}` : trimmed;
};

/** "5240 x 5240 x 6400" -> lengths [5240, 5240, 6400]; null if it isn't that shape. */
function parseDimensions(value: string): string[] | null {
  const match = /^\s*([\d,.]+)\s*(?:mm)?\s*[x×]\s*([\d,.]+)\s*(?:mm)?(?:\s*[x×]\s*([\d,.]+)\s*(?:mm)?)?\s*$/i.exec(value);
  return match ? match.slice(1).filter(Boolean) : null;
}

export function autoShape(dimensions: string): string {
  const parts = parseDimensions(dimensions);
  if (!parts) return "";
  return parts[0] === parts[1] ? "Square" : "Rectangular";
}

function formatDimensions(value: string): string {
  const parts = parseDimensions(value);
  if (!parts) return withUnit(value, "mm");
  const [length, width, height] = parts;
  return [`${length} L`, `${width} W`, height && `${height} H`].filter(Boolean).join(" x ");
}

/** "1 per tower" fans + "22" kW -> "1 x 22 kW per tower". */
function formatMotor(fans: string, kw: string): string {
  const power = kw.trim();
  if (!power) return "";
  if (!isPlainNumber(power)) return power;
  const count = /^\s*(\d+)/.exec(fans)?.[1] ?? "1";
  const per = /per\s+cell/i.test(fans) ? "per cell" : "per tower";
  return `${count} x ${power} kW ${per}`;
}

export function summaryExtra(data: Pick<ProposalData, "selectionSummary">, index: number): SummaryExtra {
  return { ...EMPTY_SUMMARY_EXTRA, ...data.selectionSummary[index] };
}

export function buildSelectionSummary(data: ProposalData, attach: SummaryAttachments): SelectionSummary {
  const towers = resolvedCommercialTowers(data).map((tower, index): SummaryTower => {
    const spec = towerSpec(data, index);
    const extra = summaryExtra(data, index);
    const shape = extra.shape || autoShape(spec.dimensions);
    const description = [
      "Induced Draft",
      tower.flowType && FLOW_LABELS[tower.flowType],
      shape,
      extra.ctiCertified ? "CTI Certified Model" : "Model",
    ]
      .filter(Boolean)
      .join(", ");
    const equipment = tower.equipment.trim();
    const heading = [`Model ${tower.model || "…"}`, equipment && `(${equipment})`].filter(Boolean).join(" ");

    const rows: [string, string, boolean][] = [
      // [label, value, required]
      ["Circulating Water Flow", withUnit(spec.condenserFlowRate, "L/s"), true],
      ["Hot (Inlet) Water Temperature", withUnit(spec.condInTemp, "°C"), true],
      ["Cold (Outlet) Water Temperature", withUnit(spec.condOutTemp, "°C"), true],
      ["Wet Bulb Temperature", withUnit(spec.wetBulbTemp, "°C"), true],
      ["Heat Rejection", withUnit(spec.kwCapacity, "kW/unit"), true],
      ["Number of Cells", spec.numberOfCells.trim(), true],
      ["No. of Air Intake", spec.airIntakes.trim(), true],
      ["Motor", formatMotor(spec.noOfFans, spec.fanKw), true],
      ["Dimensions", formatDimensions(spec.dimensions), true],
      ["Approx. Dry Weight", withUnit(spec.dryWeight, "kg"), true],
      ["Approx. Operating Weight", withUnit(spec.designOperatingWeight, "kg"), true],
    ];
    const missing = [
      !tower.model && "Model",
      !tower.flowType && "Tower Type",
      ...rows.filter(([, value, required]) => required && !value).map(([label]) => label),
    ].filter((item): item is string => Boolean(item));

    return {
      heading,
      description,
      // Blank rows are left out of the email (and listed as missing).
      rows: rows.filter(([, value]) => value).map(([label, value]) => [label, value]),
      missing,
    };
  });

  const truwater = data.commercial.scope.filter((item) => item.responsibility === "Truwater");
  const scopeLine = (match: RegExp, label: string) => {
    const material = truwater.find((item) => match.test(item.description.trim()))?.material?.trim();
    return material ? `${material} ${label}` : "";
  };
  const casing = data.spec.casingMaterial.trim();
  // Same rule as the Commercial Proposal: a blank basin is the material of construction.
  const basin = data.commercial.towers[0]?.basin.trim() || casing;
  const [framework, fanCylinder, ...rest] = SCOPE_MATERIALS.map(({ match, label }) => scopeLine(match, label));
  const [basinSupport, mechanical, wetted, nonWetted] = rest;
  const materials = [
    framework,
    casing && `${casing} Casing`,
    fanCylinder,
    basin && `${basin} Cold Water Basin`,
    basinSupport,
    mechanical,
    wetted,
    nonWetted,
  ].filter(Boolean);

  // "Dear John," from the contact's first name.
  const firstName = data.contactName.trim().split(/\s+/)[0] ?? "";
  const project = projectTitle(data);
  const attachments = [attach.technical && "Technical Proposal", attach.commercial && "Commercial Proposal"].filter(
    (item): item is string => Boolean(item)
  );
  return {
    greeting: `Dear ${firstName || "Sir/Madam"},`,
    project: project || "…",
    attachments,
    missing: [!firstName && "Contact name", !project && "TTA Quote Number / Project Name"].filter(
      (item): item is string => Boolean(item)
    ),
    towers,
    materials,
    closing: closing(attachments.length),
  };
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const FONT = "font-family:Aptos,Calibri,Arial,sans-serif;font-size:11pt;color:#000000;";
const CELL = "border:1px solid #000000;padding:1pt 5pt;vertical-align:top;";

/** Email-ready HTML with inline styles, so the layout survives pasting into Outlook or Gmail. */
export function selectionSummaryHtml(summary: SelectionSummary): string {
  const towers = summary.towers
    .map(
      (tower) =>
        `<p style="margin:0;"><b>${escapeHtml(tower.heading)}</b></p>` +
        `<p style="margin:0 0 6pt 0;">${escapeHtml(tower.description)}</p>` +
        `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 14pt 0;${FONT}">` +
        tower.rows
          .map(
            ([label, value]) =>
              `<tr><td style="${CELL}width:216pt;">${escapeHtml(label)}</td>` +
              `<td style="${CELL}width:150pt;">${escapeHtml(value)}</td></tr>`
          )
          .join("") +
        `</table>`
    )
    .join("");
  const materials = summary.materials.length
    ? `<p style="margin:12pt 0 6pt 0;"><b style="font-size:12pt;">Materials of Construction</b></p>` +
      `<ul style="margin:0 0 12pt 0;padding-left:24pt;">` +
      summary.materials.map((line) => `<li style="margin:0 0 2pt 0;">${escapeHtml(line)}</li>`).join("") +
      `</ul>`
    : "";
  const attachments = summary.attachments.length
    ? `<p style="margin:0 0 6pt 0;">Please find attached for your review:</p>` +
      `<ul style="margin:0 0 12pt 0;padding-left:24pt;">` +
      summary.attachments.map((name) => `<li style="margin:0 0 2pt 0;"><b>${escapeHtml(name)}</b></li>`).join("") +
      `</ul>`
    : "";
  return (
    `<div style="${FONT}">` +
    `<p style="margin:0 0 12pt 0;">${escapeHtml(summary.greeting)}</p>` +
    `<p style="margin:0 0 12pt 0;">Thank you for the opportunity to provide our proposal for <b>${escapeHtml(summary.project)}</b></p>` +
    attachments +
    `<p style="margin:0 0 12pt 0;"><b style="font-size:12pt;">Selection Summary</b></p>` +
    towers +
    materials +
    `<p style="margin:12pt 0 0 0;">${escapeHtml(summary.closing)}</p>` +
    `</div>`
  );
}

/** Plain-text fallback for mail apps that don't take formatted text. */
export function selectionSummaryText(summary: SelectionSummary): string {
  const width = Math.max(...summary.towers.flatMap((tower) => tower.rows.map(([label]) => label.length)), 0) + 2;
  const towers = summary.towers.map((tower) =>
    [tower.heading, tower.description, ...tower.rows.map(([label, value]) => `${label.padEnd(width)}${value}`)].join(
      "\n"
    )
  );
  const materials = summary.materials.length
    ? ["Materials of Construction", ...summary.materials.map((line) => `• ${line}`)].join("\n")
    : "";
  const attachments = summary.attachments.length
    ? ["Please find attached for your review:", ...summary.attachments.map((name) => `• ${name}`)].join("\n")
    : "";
  return [
    summary.greeting,
    `Thank you for the opportunity to provide our proposal for ${summary.project}`,
    attachments,
    "Selection Summary",
    ...towers,
    materials,
    summary.closing,
  ]
    .filter(Boolean)
    .join("\n\n");
}
