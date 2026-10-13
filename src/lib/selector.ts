import { estimateFlow, type CtiTable, type Estimate } from "@/lib/cti";

/** A maker's CTI performance table as stored for the Tower Selector. */
export type MakerTable = CtiTable & {
  id: string;
  maker: string;
  /** e.g. "AT / UT / USS". */
  series: string;
  fileName: string;
  addedAt: string; // ISO date
};

export type MakerTableInfo = Omit<MakerTable, "conditions" | "models"> & { modelCount: number };

/** "Evapco" + "AT" -> "evapco-at". */
export function tableId(maker: string, series: string): string {
  return `${maker}-${series}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "table";
}

/** What a model name tells about the tower (the CTI table only has flows). */
export type ModelDetails = {
  cells: number;
  /** Per fan motor. */
  motorHp?: number;
  motorKw?: number;
  /** Plan size (for EVAPCO nominal: the name's feet, rounded up to whole feet by the maker). */
  widthMm: number;
  lengthMm: number;
  /** The CTI table rates one cell (Truwater EC-S): towers of 2–4 cells side by side are offered too. */
  perCell?: boolean;
};

/** Most cells offered for a per-cell model. */
const MAX_CELLS = 4;

/** IEC motor size (kW) for each standard horsepower. */
const KW_FOR_HP: Record<number, number> = {
  2: 1.5, 3: 2.2, 5: 3.7, 7.5: 5.5, 10: 7.5, 15: 11, 20: 15, 25: 18.5, 30: 22, 40: 30, 50: 37, 60: 45, 75: 55, 100: 75,
};

/** EVAPCO AT/UT/USS horsepower designator: E = 2 HP to R = 100 HP (AT-UT-USS Engineering manual). */
const EVAPCO_HP: Record<string, number> = {
  E: 2, F: 3, G: 5, H: 7.5, I: 10, J: 15, K: 20, L: 25, M: 30, N: 40, O: 50, P: 60, Q: 75, R: 100,
};

const FOOT = 304.8;

/** Truwater EC-S motor size letter (kW per fan), from the EC-S Series Range data sheets. */
const TRUWATER_KW: Record<string, number> = {
  X: 1.5, Y: 2.2, Z: 3, A: 4, B: 5.5, C: 7.5, D: 11, E: 15, F: 18.5, G: 22, H: 30, I: 37, J: 45, K: 55, L: 75,
};

/** Truwater EC-S nominal box size -> overall L × W (mm) per cell, from the EC-S Series Range data sheets. */
const TRUWATER_BOX: Record<string, [number, number]> = {
  "0606": [1890, 1890], "0707": [2195, 2195], "0808": [2500, 2500], "0711": [2195, 3410], "0811": [2500, 3410],
  "0911": [2805, 3410], "1010": [3110, 3110], "1012": [3110, 3720], "1111": [3410, 3410], "1212": [3720, 3720],
  "1313": [4020, 4020], "1414": [4330, 4330], "1515": [4630, 4630], "1616": [4940, 4940], "1717": [5240, 5240],
  "1818": [5550, 5550], "2020": [6160, 6160], "2222": [6770, 6770], "2424": [7380, 7380],
};

/**
 * Model details from the name, for makers whose nomenclature is known.
 * - EVAPCO "AT 212-4N40F": 2 cells, unit 12 ft wide, 4 layers of fill, N = 40 HP per fan, unit 40 ft long.
 * - Truwater EC-S "1212G" / "ECS 1212G4-2B" / "0606X_-1U": box 1212, G = 22 kW, cells after the dash (CTI rows are
 *   per cell).
 */
export function modelDetails(name: string): ModelDetails | null {
  const truwater = /^(?:i?EC[SFTX]\s*)?(\d{4})([A-Z])[\d_]?(?:-(\d+)[A-Z]*)?$/.exec(name.trim());
  if (truwater && TRUWATER_BOX[truwater[1]]) {
    const [, box, letter, cells] = truwater;
    const [cellLength, widthMm] = TRUWATER_BOX[box];
    const count = Number(cells ?? 1);
    // Cells stand side by side along the length.
    return { cells: count, motorKw: TRUWATER_KW[letter], widthMm, lengthMm: cellLength * count, perCell: !cells };
  }
  const evapco = /^(?:AT|UT|USS)\s+(\d)(\d+)-(\d)([A-Z])(\d+)/.exec(name.trim());
  if (evapco) {
    const [, cells, width, , letter, length] = evapco;
    const hp = EVAPCO_HP[letter];
    return {
      cells: Number(cells),
      motorHp: hp,
      motorKw: hp ? KW_FOR_HP[hp] : undefined,
      widthMm: Math.round(Number(width) * FOOT),
      lengthMm: Math.round(Number(length) * FOOT),
    };
  }
  return null;
}

export type Duty = {
  flow: number; // L/s
  hot: number; // °C in
  cold: number; // °C out
  wetBulb: number;
  /**
   * Targets, not limits (the RFQ's numbers are estimates): the pick is the tower closest to them. Motor per fan
   * (kW): "exact" = about that size, "max" = that size or smaller preferred.
   */
  motorKw?: number;
  motorMatch: "exact" | "max";
  cells?: number;
  /** Space available, roughly (either way round); a tower bigger than this counts against it more than a smaller one. */
  maxLengthMm?: number;
  maxWidthMm?: number;
};

export type Candidate = {
  tableId: string;
  maker: string;
  series: string;
  model: string;
  estimate: Estimate;
  /** % above the required flow. */
  margin: number;
  details: ModelDetails | null;
};

/** Why a duty can't be looked up yet, or null when it's complete. */
export function dutyProblem(duty: Partial<Duty>): string | null {
  const { flow, hot, cold, wetBulb } = duty;
  if (![flow, hot, cold, wetBulb].every((v) => typeof v === "number" && Number.isFinite(v))) {
    return "Fill in the flow, water in, water out and wet bulb.";
  }
  if (!(flow! > 0)) return "The flow must be more than 0 L/s.";
  if (!(hot! > cold!)) return "Water in must be hotter than water out.";
  if (!(cold! > wetBulb!)) return "Water out must be warmer than the wet bulb.";
  return null;
}

/**
 * Every model that cools the duty's flow, smallest margin first. Models rated per cell are also offered as
 * towers of 2–4 cells ("1212G-2"), each cell taking an equal share of the flow.
 */
export function selectTowers(tables: MakerTable[], duty: Duty): Candidate[] {
  const condition = { wetBulb: duty.wetBulb, range: duty.hot - duty.cold, approach: duty.cold - duty.wetBulb };
  const candidates: Candidate[] = [];
  for (const table of tables) {
    for (const model of table.models) {
      const estimate = estimateFlow(table.conditions, model, condition);
      if (!estimate) continue;
      const details = modelDetails(model.name);
      const cellCounts = details?.perCell ? Array.from({ length: MAX_CELLS }, (_, i) => i + 1) : [1];
      for (const cells of cellCounts) {
        const flow = estimate.flow * cells;
        if (flow < duty.flow) continue;
        candidates.push({
          tableId: table.id,
          maker: table.maker,
          series: table.series,
          model: cells > 1 ? `${model.name.replace(/[_-]+$/, "")}-${cells}` : model.name,
          estimate: { ...estimate, flow, nearest: { ...estimate.nearest, flow: estimate.nearest.flow * cells } },
          margin: (flow / duty.flow - 1) * 100,
          details: details && cells > 1 ? { ...details, cells, lengthMm: details.lengthMm * cells } : details,
        });
      }
    }
  }
  return candidates.sort((a, b) => a.margin - b.margin);
}

/** Total motor power of a model (all fans), when known. */
export const totalKw = (c: Candidate) =>
  c.details?.motorKw !== undefined ? c.details.motorKw * c.details.cells : undefined;

/** Plan area in m², when known. */
export const planArea = (c: Candidate) =>
  c.details ? (c.details.lengthMm * c.details.widthMm) / 1e6 : undefined;

const hasSpace = (duty: Duty) => !!(duty.maxLengthMm || duty.maxWidthMm);

/** How far a plan is from the space typed: going over counts 3×, coming in under 1× (best way round). */
function spaceMiss(details: ModelDetails, duty: Duty): number {
  const miss = (size: number, target?: number) =>
    !target ? 0 : size > target ? (3 * (size - target)) / target : (target - size) / target;
  return Math.min(
    miss(details.lengthMm, duty.maxLengthMm) + miss(details.widthMm, duty.maxWidthMm),
    miss(details.widthMm, duty.maxLengthMm) + miss(details.lengthMm, duty.maxWidthMm)
  );
}

/** How far a motor is from the one typed (relative): "max" counts a bigger motor 3×, a smaller one ½×. */
function motorMiss(kw: number, duty: Duty): number {
  const d = (kw - duty.motorKw!) / duty.motorKw!;
  return duty.motorMatch === "max" ? (d > 0 ? 3 * d : -0.5 * d) : 2 * Math.abs(d);
}

/**
 * How well a tower suits the duty, lower is better. The margin above the minimum always counts (closest fit);
 * motor, cells and space count towards the numbers typed or, when none were typed, towards a compact tower with
 * a low motor power.
 */
function score(c: Candidate, duty: Duty, minMargin: number, smallestArea: number, lowestKw: number): number {
  let total = (c.margin - minMargin) / 10;
  if (c.estimate.extrapolated) total += 1;
  const d = c.details;
  // Motor and size unknown: picked only when nothing known suits better.
  if (!d) return total + 1.5;
  total += hasSpace(duty) ? 2 * spaceMiss(d, duty) : 2 * ((d.lengthMm * d.widthMm) / 1e6 / smallestArea - 1);
  if (d.motorKw === undefined) total += 0.5;
  else if (duty.motorKw) total += 1.5 * motorMiss(d.motorKw, duty);
  else total += 0.5 * ((d.motorKw * d.cells) / lowestKw - 1);
  if (duty.cells) total += Math.abs(d.cells - duty.cells);
  return total;
}

/**
 * Towers ranked for the duty, best first: those with at least `minMargin` % spare capacity by how well they suit
 * it, then the ones short of the minimum margin (most spare first).
 */
export function rankTowers(candidates: Candidate[], duty: Duty, minMargin: number): Candidate[] {
  const eligible = candidates.filter((c) => c.margin >= minMargin);
  const areas = eligible.map(planArea).filter((a): a is number => a !== undefined);
  const powers = eligible.map(totalKw).filter((k): k is number => k !== undefined && k > 0);
  const smallestArea = areas.length ? Math.min(...areas) : 1;
  const lowestKw = powers.length ? Math.min(...powers) : 1;
  const scored = eligible
    .map((c) => ({ c, s: score(c, duty, minMargin, smallestArea, lowestKw) }))
    .sort((a, b) => a.s - b.s || a.c.margin - b.c.margin)
    .map(({ c }) => c);
  const short = candidates.filter((c) => c.margin < minMargin).sort((a, b) => b.margin - a.margin);
  return [...scored, ...short];
}

export type Recommendation = {
  /** The tower to use: the best suited with at least the minimum margin. */
  best: Candidate;
  /** Other picks worth a look, when they differ from the best. */
  smallest?: Candidate;
  lowestPower?: Candidate;
};

/** The tower to use (first of the ranked list), with the smallest plan and the lowest motor power as alternatives. */
export function recommend(ranked: Candidate[], minMargin: number): Recommendation | null {
  const eligible = ranked.filter((c) => c.margin >= minMargin);
  const best = eligible[0];
  if (!best) return null;
  const pick = (value: (c: Candidate) => number | undefined) =>
    eligible
      .filter((c) => value(c) !== undefined)
      .reduce<Candidate | undefined>(
        (a, c) => (!a || value(c)! < value(a)! || (value(c) === value(a) && c.margin < a.margin) ? c : a),
        undefined
      );
  const smallest = pick(planArea);
  const lowestPower = pick(totalKw);
  return {
    best,
    smallest: smallest && smallest !== best ? smallest : undefined,
    lowestPower: lowestPower && lowestPower !== best && lowestPower !== smallest ? lowestPower : undefined,
  };
}

/** How a tower compares with the numbers typed, e.g. "Plan 5,486 × 3,658 mm (your space 3,651 × 3,607)". */
export function matchNotes(c: Candidate, duty: Duty): string[] {
  const d = c.details;
  if (!d) return ["Motor and size not known for this maker."];
  const n = (v: number) => v.toLocaleString("en-AU", { maximumFractionDigits: 1 });
  const notes: string[] = [];
  if (duty.motorKw && d.motorKw !== undefined) {
    notes.push(
      d.motorKw === duty.motorKw ? `Motor ${n(d.motorKw)} kW as typed` : `Motor ${n(d.motorKw)} kW (you typed ${n(duty.motorKw)} kW)`
    );
  }
  if (duty.cells && d.cells !== duty.cells) notes.push(`${d.cells} ${d.cells === 1 ? "cell" : "cells"} (you typed ${duty.cells})`);
  if (hasSpace(duty)) {
    const target = [duty.maxLengthMm, duty.maxWidthMm].map((v) => (v ? n(v) : "any")).join(" × ");
    notes.push(`Plan ${n(d.lengthMm)} × ${n(d.widthMm)} mm (your space ${target})`);
  }
  return notes;
}
