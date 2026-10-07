/**
 * Reads RFQ values out of the text of a scanned document. Built around the Cooling Tower Bid Form
 * (TCT-F05A, Malaysian and Australian layouts), with looser label matching so customer specs that
 * print "Label: value" are picked up too. No imports, so it can be tested on its own in Node.
 */

/** One piece of text on a page, from the PDF itself or from OCR. `y` grows downwards. */
export type TextItem = { text: string; x: number; y: number; width: number; height: number };

/** Every value the scanner can fill in. */
export type ScanFieldId =
  | "quoteNumber"
  | "projectName"
  | "customerDetail"
  | "contactName"
  | "contactPhone"
  | "contactEmail"
  | "towerModel"
  | "equipment"
  | "flowType"
  | "shape"
  | "ctiCertified"
  | "casingMaterial"
  | "fillMaterial"
  | "numberOfCells"
  | "airIntakes"
  | "kwCapacity"
  | "condenserFlowRate"
  | "condInTemp"
  | "condOutTemp"
  | "wetBulbTemp"
  | "noOfFans"
  | "fanKw"
  | "fanDriveType"
  | "dimensions"
  | "dryWeight"
  | "designOperatingWeight";

/** A value found in the document, with the text it came from (shown in the review list). */
export type ScanFinding = { value: string; source: string };

export type ScanResult = Partial<Record<ScanFieldId, ScanFinding>>;

/** A line of text: its cells are runs of words with no wide gap between them, left to right. */
type Line = string[];

/** Groups items into lines (same height on the page) and each line into cells (split at wide gaps). */
export function toLines(pages: TextItem[][]): Line[] {
  const lines: Line[] = [];
  for (const page of pages) {
    const items = page.filter((item) => item.text.trim()).sort((a, b) => a.y - b.y);
    const rows: { y: number; height: number; items: TextItem[] }[] = [];
    for (const item of items) {
      const row = rows.find((r) => Math.abs(r.y - item.y) <= Math.max(r.height, item.height) * 0.45);
      if (row) row.items.push(item);
      else rows.push({ y: item.y, height: item.height, items: [item] });
    }
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      const cells: string[] = [];
      let previous: TextItem | undefined;
      for (const item of row.items) {
        const gap = previous ? item.x - (previous.x + previous.width) : Infinity;
        // A gap under ~one character height is a word space; anything wider starts a new column.
        if (gap < Math.max(item.height, 4) * 0.8) cells[cells.length - 1] += ` ${item.text.trim()}`;
        else cells.push(item.text.trim());
        previous = item;
      }
      lines.push(cells);
    }
  }
  return lines;
}

/** Raw label values, before they're turned into RFQ fields. */
type RawKey =
  | "to"
  | "attn"
  | "tel"
  | "email"
  | "project"
  | "series"
  | "model"
  | "type"
  | "heat"
  | "cells"
  | "airIntakes"
  | "flow"
  | "hot"
  | "cold"
  | "wetBulb"
  | "length"
  | "width"
  | "height"
  | "dimensions"
  | "dryWeight"
  | "operatingWeight"
  | "casing"
  | "fill"
  | "fanQuantity"
  | "fanDiameter"
  | "fanKw"
  | "drive";

/**
 * Labels for each value, tried at the start of a cell (case-insensitive). The bid form wording
 * comes first; the rest are common wordings in customer specs.
 */
const LABELS: Record<RawKey, RegExp[]> = {
  to: [/^to(?=\s*:|$)/i],
  attn: [/^attn\.?/i, /^attention/i],
  // Not a bare "Tel"/"Phone": the bid form letterhead prints Truwater's own number that way.
  tel: [/^tel\.?\s*no\.?/i, /^(mobile|mob\.?)(?=\s*:|$)/i],
  email: [/^e-?mail/i],
  project: [/^project(\s+name)?(?=\s*:|$)/i],
  series: [/^cooling tower series/i],
  model: [/^(cooling\s+)?tower model/i, /^model(\s+no\.?)?(?=\s*:|$)/i],
  type: [/^type(?=\s*:|$)/i, /^tower type/i],
  heat: [/^heat load rejection/i, /^heat rejection/i, /^(design\s+)?heat load(?!\/)/i, /^(thermal\s+)?capacity/i, /^cooling (capacity|duty)/i],
  cells: [/^no\.?\s*of\s*cells/i, /^number of cells/i, /^cells(?=\s*:|$)/i],
  airIntakes: [/^no\.?\s*of\s*air\s*intakes?/i, /^air intakes?/i, /^air inlets?/i],
  flow: [/^circulating water flow/i, /^(condenser\s+|design\s+)?water flow(\s+rate)?/i, /^flow\s*rate/i],
  hot: [/^hot\s*\(inlet\)\s*water temp/i, /^(hot|entering|inlet) water temp/i, /^(condenser\s+)?water in(let)? temp/i],
  cold: [/^cold\s*\(outlet\)\s*water temp/i, /^(cold|leaving|outlet) water temp/i, /^(condenser\s+)?water out(let)? temp/i],
  wetBulb: [/^(design\s+|ambient\s+)?wet bulb/i],
  length: [/^length(\s*\(l\))?/i],
  width: [/^width(\s*\(w\))?/i],
  height: [/^overall height(\s*\(h\))?/i, /^height(\s*\(h\))?/i],
  dimensions: [/^(overall\s+)?dimensions?/i],
  dryWeight: [/^approx(imate|\.)?\s*dry weight/i, /^dry weight/i, /^shipping weight/i],
  operatingWeight: [/^approx(imate|\.)?\s*operating weight/i, /^operating weight/i],
  casing: [/^casing(\s+material)?/i],
  fill: [/^fill(\s+media|\s+material)?(?=\s*:|$)/i, /^infill/i],
  fanQuantity: [/^quantity/i, /^no\.?\s*of\s*fans/i, /^number of fans/i],
  fanDiameter: [/^fan diameter/i],
  fanKw: [/^rated kw per cell/i, /^(fan\s+)?motor (power|rating|kw)/i, /^fan kw/i],
  drive: [/^type of drive/i, /^(fan\s+)?drive(\s+type)?(?=\s*:|$)/i],
};

/** Other labels that end a value: the bid form header puts a second label column on the same lines. */
const STOP_LABELS = [/^our ref/i, /^from(?=\s*:|$)/i, /^date(?=\s*:|$)/i, /^fax\b/i, /^form no/i, /^rev(?=\s*:|$)/i];

// OCR sometimes drops the spaces between words ("OurRef.No"), so a space in a label matches none too.
const loose = (label: RegExp) => new RegExp(label.source.replace(/ /g, "\\s*"), label.flags);
for (const key of Object.keys(LABELS) as RawKey[]) LABELS[key] = LABELS[key].map(loose);

const ALL_LABELS = [...Object.values(LABELS).flat(), ...STOP_LABELS.map(loose)];

/** "Three (3)" -> 3, "2 Sides" -> 2, "Four" -> 4. */
const WORD_NUMBERS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
function count(value: string): number | null {
  const digits = /\((\d+)\)/.exec(value)?.[1] ?? /\b(\d+)\b/.exec(value)?.[1];
  if (digits) return Number(digits);
  const word = WORD_NUMBERS.indexOf(/[a-z]+/i.exec(value)?.[0].toLowerCase() ?? "");
  return word >= 0 ? word : null;
}

/** The first number as printed ("8,010"), or null. */
const number = (value: string) => /\d[\d,]*(\.\d+)?/.exec(value)?.[0] ?? null;
const plain = (value: string) => value.replace(/,/g, "");

/** Value cells after a label: up to the next cell that is itself a known label. */
function valueAfter(cells: string[], index: number, rest: string): string {
  const parts = [rest];
  for (const cell of cells.slice(index + 1)) {
    if (ALL_LABELS.some((label) => label.test(cell))) break;
    parts.push(cell);
  }
  return (
    parts
      .join(" ")
      // Table borders read as "|" and underlined form fields as "_" on scans.
      .replace(/(^|\s)\|+(?=\s|$)/g, " ")
      .replace(/^[\s:.\-–_|]+/, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * The first value for `key` that `accept` takes: labels in order of preference, each read top to bottom.
 * Taking the first match keeps "Type" and "Quantity" to the first section they appear in (General, then Fan).
 */
function find(lines: Line[], key: RawKey, accept: (value: string) => boolean = Boolean): ScanFinding | null {
  for (const label of LABELS[key]) {
    for (const cells of lines) {
      for (let i = 0; i < cells.length; i++) {
        const match = label.exec(cells[i]);
        if (!match) continue;
        const value = valueAfter(cells, i, cells[i].slice(match[0].length));
        if (value && accept(value)) return { value, source: `${cells[i].slice(0, match[0].length).trim()}: ${value}` };
      }
    }
  }
  return null;
}

const hasNumber = (value: string) => number(value) !== null;

/** Flow in L/s, converting m³/hr and US gpm. Bid forms print "l/s" in a font that reads as "I/s". */
function litresPerSecond(value: string): string | null {
  const amount = number(value);
  if (!amount) return null;
  const n = Number(plain(amount));
  if (/m\s*(3|³)\s*\/\s*h/i.test(value)) return String(Math.round((n / 3.6) * 100) / 100);
  if (/gpm/i.test(value)) return String(Math.round(n * 0.0630902 * 100) / 100);
  return amount;
}

/** kW from "2,742,228 kcal/hr/unit 3189 kW/unit"; converts kcal/hr or MW when there's no kW figure. */
function kilowatts(value: string): string | null {
  const kw = /(\d[\d,]*(?:\.\d+)?)\s*kw/i.exec(value)?.[1];
  if (kw) return kw;
  const mw = /(\d[\d,]*(?:\.\d+)?)\s*mw/i.exec(value)?.[1];
  if (mw) return String(Math.round(Number(plain(mw)) * 1000));
  const kcal = /(\d[\d,]*(?:\.\d+)?)\s*kcal/i.exec(value)?.[1];
  if (kcal) return String(Math.round(Number(plain(kcal)) / 860.42));
  return number(value);
}

/** "SS 316" -> "SS316" and "FRP (2mm thickness)" -> "FRP", matching how materials are typed on the forms. */
const material = (value: string) =>
  value
    .replace(/\([^)]*\)/g, "")
    .replace(/\bSS\s+(\d{3})/gi, "SS$1")
    .replace(/\s+/g, " ")
    .trim();

/** "ECX 1212D2-3B (CT01 & 02)" -> model "ECX 1212D2-3B", equipment "CT01 & 02". */
function splitModel(value: string) {
  // "CTO1" from OCR is "CT01".
  const equipment = (/\(([^)]*)\)/.exec(value)?.[1]?.trim() ?? "").replace(/\bCTO(?=\d)/gi, "CT0");
  return { model: value.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim(), equipment };
}

export function parseScan(lines: Line[]): ScanResult {
  const result: ScanResult = {};
  const set = (id: ScanFieldId, value: string | null | undefined, source: ScanFinding | null) => {
    if (value && source) result[id] = { value, source: source.source };
  };

  // Header: who it's for.
  const to = find(lines, "to");
  set("customerDetail", to?.value, to);
  const attn = find(lines, "attn");
  set("contactName", attn?.value, attn);
  const tel = find(lines, "tel", (v) => /\d{6,}/.test(v.replace(/[\s()+-]/g, "")));
  set("contactPhone", tel?.value, tel);
  // Truwater's own address appears on the drawings; the customer's is what's wanted.
  const email = find(lines, "email", (v) => /\S+@\S+\.\S+/.test(v) && !/@truwater\./i.test(v));
  set("contactEmail", email && /\S+@\S+\.\S+/.exec(email.value)?.[0], email);
  const project = find(lines, "project");
  if (project) {
    // "TTA0151 Arthur Gorrie Correctional Institute" -> quote number + project name.
    // OCR can read a zero as the letter O ("TTAO151").
    const quote = /^(TTA\s?[\dO]{3,5})\b\s*/i.exec(project.value);
    set("quoteNumber", quote && `TTA${quote[1].slice(3).replace(/\s/g, "").replace(/o/gi, "0")}`, project);
    set("projectName", quote ? project.value.slice(quote[0].length) : project.value, project);
  }

  // General.
  const model = find(lines, "model", (v) => /\d/.test(v));
  if (model) {
    const { model: name, equipment } = splitModel(model.value);
    set("towerModel", name, model);
    set("equipment", equipment, model);
  }
  const type = find(lines, "type", (v) => /flow|draft|circuit|square|rectangular|round/i.test(v));
  if (type) {
    const flow = /counter\s*-?\s*flow/i.test(type.value)
      ? "Counterflow"
      : /cross\s*-?\s*flow/i.test(type.value)
        ? "Crossflow"
        : /closed\s*circuit|fluid cooler|evaporative cooler/i.test(type.value)
          ? "Closed Circuit"
          : null;
    set("flowType", flow, type);
    set("shape", /\b(square|rectangular|round)\b/i.exec(type.value)?.[1].replace(/^./, (c) => c.toUpperCase()), type);
  }
  const series = find(lines, "series");
  if (series || type) {
    const cti = [series?.value, type?.value].some((v) => v && /\bCTI\b/i.test(v));
    set("ctiCertified", cti ? "Yes" : "No", series ?? type);
  }
  const heat = find(lines, "heat", hasNumber);
  set("kwCapacity", heat && kilowatts(heat.value), heat);
  const cells = find(lines, "cells", (v) => count(v) !== null);
  const cellCount = cells ? count(cells.value) : null;
  set("numberOfCells", cellCount === null ? null : String(cellCount), cells);
  const intakes = find(lines, "airIntakes", (v) => count(v) !== null);
  set("airIntakes", intakes && String(count(intakes.value)), intakes);

  // Design conditions.
  const flow = find(lines, "flow", hasNumber);
  set("condenserFlowRate", flow && litresPerSecond(flow.value), flow);
  const hot = find(lines, "hot", hasNumber);
  set("condInTemp", hot && number(hot.value), hot);
  const cold = find(lines, "cold", hasNumber);
  set("condOutTemp", cold && number(cold.value), cold);
  const wetBulb = find(lines, "wetBulb", hasNumber);
  set("wetBulbTemp", wetBulb && number(wetBulb.value), wetBulb);

  // Dimensions and weights: L x W x H, as typed on the form ("3499 x 3499").
  const [length, width, height] = (["length", "width", "height"] as const).map((key) => find(lines, key, hasNumber));
  if (length && width) {
    const sizes = [length, width, height].flatMap((f) => (f ? [plain(number(f.value) ?? "")] : []));
    set("dimensions", sizes.join(" x "), { value: "", source: [length, width, height].filter(Boolean).map((f) => f!.source).join(" · ") });
  } else {
    const dimensions = find(lines, "dimensions", (v) => /\d\s*[x×]\s*\d/i.test(v));
    set("dimensions", dimensions?.value.replace(/\s*mm\b/gi, "").replace(/\s*[x×]\s*/gi, " x ").replace(/,/g, ""), dimensions);
  }
  const dry = find(lines, "dryWeight", hasNumber);
  set("dryWeight", dry && number(dry.value), dry);
  const operating = find(lines, "operatingWeight", hasNumber);
  set("designOperatingWeight", operating && number(operating.value), operating);

  // Materials.
  const casing = find(lines, "casing");
  set("casingMaterial", casing && material(casing.value), casing);
  const fill = find(lines, "fill");
  set("fillMaterial", fill && material(fill.value), fill);

  // Fans and motors: "1 per cell" on multi-cell towers, "1 per tower" otherwise.
  const quantity = find(lines, "fanQuantity", (v) => count(v) !== null);
  const diameter = find(lines, "fanDiameter", hasNumber);
  const fans = quantity
    ? count(quantity.value)
    : diameter && /[x×]\s*(\d+)/i.test(diameter.value)
      ? Number(/[x×]\s*(\d+)/i.exec(diameter.value)![1])
      : null;
  if (fans) {
    const perCell = cellCount && cellCount > 1 && fans % cellCount === 0;
    set("noOfFans", perCell ? `${fans / cellCount} per cell` : `${fans} per tower`, quantity ?? diameter);
  }
  const fanKw = find(lines, "fanKw", hasNumber);
  set("fanKw", fanKw && number(fanKw.value), fanKw);
  const drive = find(lines, "drive");
  if (drive) {
    const kind = /belt/i.test(drive.value) ? "Belt" : /direct/i.test(drive.value) ? "Direct" : /gear/i.test(drive.value) ? "Gear" : drive.value;
    set("fanDriveType", kind, drive);
  }

  return result;
}
