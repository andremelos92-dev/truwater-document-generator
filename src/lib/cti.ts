import type { TextItem } from "@/lib/scan-parse";

/**
 * CTI certified performance tables ("CTI_49_SI"): one row per tower model, one column per rating condition
 * (wet bulb, range and approach in °C), each cell the water flow in L/s the model is certified for at that
 * condition, or "NC" (not certified). Every maker's certified line is published in this same layout.
 */

export type CtiCondition = { wetBulb: number; range: number; approach: number };

export type CtiModel = {
  name: string;
  /** L/s per condition, in the table's column order; null where the table says NC. */
  flows: (number | null)[];
};

export type CtiTable = { conditions: CtiCondition[]; models: CtiModel[] };

const NUMBER = /^-?\d+(\.\d+)?$/;

type Row = { y: number; items: TextItem[] };

/** Text items grouped into rows (same height on the page), each sorted left to right. */
function rows(page: TextItem[]): Row[] {
  const out: Row[] = [];
  for (const item of [...page].filter((i) => i.text.trim()).sort((a, b) => a.y - b.y)) {
    const row = out.find((r) => Math.abs(r.y - item.y) <= Math.max(item.height, 2) * 0.4);
    if (row) row.items.push(item);
    else out.push({ y: item.y, items: [item] });
  }
  for (const row of out) row.items.sort((a, b) => a.x - b.x);
  return out;
}

const center = (item: TextItem) => item.x + item.width / 2;

/**
 * Reads a CTI performance table from a PDF's text. Each page repeats the condition header; a model row
 * starts with its name left of the first column. Throws when the document isn't in this layout.
 */
export function parseCtiTable(pages: TextItem[][]): CtiTable {
  let conditions: CtiCondition[] | null = null;
  const models = new Map<string, CtiModel>();

  for (const page of pages) {
    // Some certifications print the table sideways (turned 90° on a portrait page): try it both ways round.
    // Turned text runs along the page's height, so its width isn't across the columns any more.
    const turned = (sign: 1 | -1) => page.map((i) => ({ ...i, x: -sign * i.y, y: sign * i.x, width: 0 }));
    let pageRows: Row[] = [];
    let header: Row | undefined;
    // The header row: "Condition Reference #" followed by the condition numbers.
    const numbers = (row: Row) => row.items.filter((i) => NUMBER.test(i.text.trim()));
    for (const items of [page, turned(1), turned(-1)]) {
      pageRows = rows(items);
      header = pageRows.find((r) => /condition reference/i.test(r.items[0]?.text ?? "") && numbers(r).length >= 5);
      if (header) break;
    }
    if (!header) continue;
    const columns = numbers(header).map(center);
    const spacing = (columns[columns.length - 1] - columns[0]) / (columns.length - 1);
    const columnOf = (item: TextItem) => {
      const x = center(item);
      let best = -1;
      let distance = spacing * 0.6;
      columns.forEach((c, i) => {
        if (Math.abs(c - x) < distance) {
          distance = Math.abs(c - x);
          best = i;
        }
      });
      return best;
    };
    const labelled = (pattern: RegExp) => {
      const row = pageRows.find((r) => pattern.test(r.items[0]?.text ?? ""));
      const values: number[] = [];
      for (const item of row?.items.slice(1) ?? []) {
        const at = columnOf(item);
        if (at >= 0 && NUMBER.test(item.text.trim())) values[at] = Number(item.text);
      }
      return values;
    };
    const wetBulb = labelled(/^wet bulb/i);
    const range = labelled(/^range/i);
    const approach = labelled(/^approach/i);
    conditions ??= columns.map((_, i) => ({ wetBulb: wetBulb[i], range: range[i], approach: approach[i] }));

    const firstColumn = columns[0] - spacing * 0.6;
    for (const row of pageRows) {
      if (row === header) continue;
      const label = row.items.filter((i) => i.x + i.width < firstColumn).map((i) => i.text.trim()).join(" ");
      // Section breaks print as a row of zeros under a "0" label.
      if (!label || /^[\d\s.]*$/.test(label) || /^(wet bulb|range|approach|inlet|outlet|condition)/i.test(label)) continue;
      const cells = row.items.filter((i) => i.x + i.width >= firstColumn);
      if (cells.length < columns.length / 2) continue;
      const flows: (number | null)[] = columns.map(() => null);
      for (const cell of cells) {
        const at = columnOf(cell);
        const text = cell.text.trim();
        if (at >= 0 && NUMBER.test(text)) flows[at] = Number(text);
      }
      models.set(label.replace(/\s+/g, " "), { name: label.replace(/\s+/g, " "), flows });
    }
  }

  if (!conditions || conditions.some((c) => [c.wetBulb, c.range, c.approach].some((v) => !Number.isFinite(v)))) {
    throw new Error("This doesn't look like a CTI performance table (no Condition Reference / Wet Bulb / Range / Approach header).");
  }
  if (models.size === 0) throw new Error("No tower models were found in the table.");
  return { conditions, models: [...models.values()] };
}

/** The terms the flow is fitted on: ln(flow) is close to linear in these over a CTI table's conditions. */
function terms({ wetBulb: w, range: r, approach: a }: CtiCondition): number[] {
  const la = Math.log(a);
  const lr = Math.log(r);
  return [1, w, w * w, lr, la, la * la, w * la, w * lr, lr * la];
}

/** Least squares by the normal equations (small systems only). Returns null when they're singular. */
function leastSquares(x: number[][], y: number[], weights: number[]): number[] | null {
  const n = x[0].length;
  const a = Array.from({ length: n }, () => new Array<number>(n + 1).fill(0));
  x.forEach((row, k) => {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) a[i][j] += weights[k] * row[i] * row[j];
      a[i][n] += weights[k] * row[i] * y[k];
    }
  });
  // A little ridge keeps sparse models (many NC cells) solvable.
  for (let i = 1; i < n; i++) a[i][i] += 1e-6;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    if (Math.abs(a[pivot][col]) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r][col] / a[col][col];
      for (let c = col; c <= n; c++) a[r][c] -= f * a[col][c];
    }
  }
  return a.map((row, i) => row[n] / row[i]);
}

/** How far a condition is from the duty, in °C-like units (approach matters most, then wet bulb). */
function distance(a: CtiCondition, b: CtiCondition): number {
  return Math.hypot((a.wetBulb - b.wetBulb) / 6, (a.range - b.range) / 2, (Math.log(a.approach) - Math.log(b.approach)) / 0.35);
}

export type Estimate = {
  /** L/s the model is expected to cool at the duty. */
  flow: number;
  /** The certified condition closest to the duty, with the model's flow there. */
  nearest: { index: number; condition: CtiCondition; flow: number };
  /** True when the duty is outside the table's certified conditions for this model (less reliable). */
  extrapolated: boolean;
};

/**
 * The flow a model can take at a duty, fitted from its certified flows: ln(flow) on wet bulb, range and
 * approach, weighted towards the conditions nearest the duty.
 */
export function estimateFlow(conditions: CtiCondition[], model: CtiModel, duty: CtiCondition): Estimate | null {
  const points = conditions.flatMap((condition, index) => {
    const flow = model.flows[index];
    return flow && flow > 0 ? [{ condition, index, flow }] : [];
  });
  if (points.length < 12) return null;
  const nearest = points.reduce((best, p) =>
    distance(p.condition, duty) < distance(best.condition, duty) ? p : best
  );
  const coefficients = leastSquares(
    points.map((p) => terms(p.condition)),
    points.map((p) => Math.log(p.flow)),
    points.map((p) => Math.exp(-((distance(p.condition, duty) / 1.5) ** 2)) + 0.05)
  );
  if (!coefficients) return null;
  const flow = Math.exp(terms(duty).reduce((sum, t, i) => sum + t * coefficients[i], 0));
  const within = (key: keyof CtiCondition) => {
    const values = points.map((p) => p.condition[key]);
    return duty[key] >= Math.min(...values) - 0.01 && duty[key] <= Math.max(...values) + 0.01;
  };
  return {
    flow,
    nearest: { index: nearest.index, condition: nearest.condition, flow: nearest.flow },
    extrapolated: !within("wetBulb") || !within("range") || !within("approach"),
  };
}
