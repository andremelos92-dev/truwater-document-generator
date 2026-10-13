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
  /** Nominal plan size: the name's feet, rounded up to whole feet by the maker. */
  widthMm: number;
  lengthMm: number;
};

/** IEC motor size (kW) for each standard horsepower. */
const KW_FOR_HP: Record<number, number> = {
  2: 1.5, 3: 2.2, 5: 3.7, 7.5: 5.5, 10: 7.5, 15: 11, 20: 15, 25: 18.5, 30: 22, 40: 30, 50: 37, 60: 45, 75: 55, 100: 75,
};

/** EVAPCO AT/UT/USS horsepower designator: E = 2 HP to R = 100 HP (AT-UT-USS Engineering manual). */
const EVAPCO_HP: Record<string, number> = {
  E: 2, F: 3, G: 5, H: 7.5, I: 10, J: 15, K: 20, L: 25, M: 30, N: 40, O: 50, P: 60, Q: 75, R: 100,
};

const FOOT = 304.8;

/**
 * Model details from the name, for makers whose nomenclature is known. EVAPCO "AT 212-4N40F": 2 cells, unit
 * 12 ft wide, 4 layers of fill, N = 40 HP per fan, unit 40 ft long.
 */
export function modelDetails(name: string): ModelDetails | null {
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
  /** Motor per fan (kW); with `motorMatch` "exact" only that size, "max" that size or smaller. */
  motorKw?: number;
  motorMatch: "exact" | "max";
  cells?: number;
  /** Space available (either way round). */
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

const fits = (details: ModelDetails, duty: Duty) => {
  const { maxLengthMm: l, maxWidthMm: w } = duty;
  if (!l && !w) return true;
  const L = l ?? Infinity;
  const W = w ?? Infinity;
  return (details.lengthMm <= L && details.widthMm <= W) || (details.lengthMm <= W && details.widthMm <= L);
};

/**
 * Every model that cools the duty's flow, smallest margin first. Motor, cells and footprint filters only
 * apply to models whose details are known; the others are kept and shown without them.
 */
export function selectTowers(tables: MakerTable[], duty: Duty): Candidate[] {
  const condition = { wetBulb: duty.wetBulb, range: duty.hot - duty.cold, approach: duty.cold - duty.wetBulb };
  const candidates: Candidate[] = [];
  for (const table of tables) {
    for (const model of table.models) {
      const details = modelDetails(model.name);
      if (details) {
        if (duty.motorKw && details.motorKw !== undefined) {
          if (duty.motorMatch === "exact" ? details.motorKw !== duty.motorKw : details.motorKw > duty.motorKw) continue;
        }
        if (duty.cells && details.cells !== duty.cells) continue;
        if (!fits(details, duty)) continue;
      }
      const estimate = estimateFlow(table.conditions, model, condition);
      if (!estimate || estimate.flow < duty.flow) continue;
      candidates.push({
        tableId: table.id,
        maker: table.maker,
        series: table.series,
        model: model.name,
        estimate,
        margin: (estimate.flow / duty.flow - 1) * 100,
        details,
      });
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

export type Recommendation = {
  /** The closest fit with at least the minimum margin: the tower to use. */
  best: Candidate;
  /** Other picks worth a look, when they differ from the best. */
  smallest?: Candidate;
  lowestPower?: Candidate;
};

/**
 * The tower to use: of the models with at least `minMargin` % spare capacity, the one with the least
 * (closest fit). The smallest plan and the lowest motor power among them are offered as alternatives.
 */
export function recommend(candidates: Candidate[], minMargin: number): Recommendation | null {
  const eligible = candidates.filter((c) => c.margin >= minMargin);
  const best = eligible[0];
  if (!best) return null;
  const pick = (score: (c: Candidate) => number | undefined) =>
    eligible
      .filter((c) => score(c) !== undefined)
      .reduce<Candidate | undefined>((a, c) => (!a || score(c)! < score(a)! || (score(c) === score(a) && c.margin < a.margin) ? c : a), undefined);
  const smallest = pick(planArea);
  const lowestPower = pick(totalKw);
  return {
    best,
    smallest: smallest && smallest !== best ? smallest : undefined,
    lowestPower: lowestPower && lowestPower !== best && lowestPower !== smallest ? lowestPower : undefined,
  };
}
