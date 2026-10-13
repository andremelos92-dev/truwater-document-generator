"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Award, FileUp, Loader2, ScanLine, Trash2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { parseCtiTable, type CtiTable } from "@/lib/cti";
import { parseScan, toLines } from "@/lib/scan-parse";
import { readDocument } from "@/lib/scan-source";
import {
  dutyProblem,
  matchNotes,
  planArea,
  rankTowers,
  recommend,
  selectTowers,
  totalKw,
  type Candidate,
  type Duty,
  type MakerTable,
  type MakerTableInfo,
} from "@/lib/selector";
import { cn } from "@/lib/utils";

const dateFormat = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" });

/** Results shown before "Show more". */
const PAGE = 25;

type DutyField = "flow" | "hot" | "cold" | "wetBulb" | "motorKw" | "cells" | "maxLengthMm" | "maxWidthMm";

const DUTY_FIELDS: { id: DutyField; label: string; unit: string; placeholder: string }[] = [
  { id: "flow", label: "Water flow", unit: "L/s", placeholder: "e.g. 106.76" },
  { id: "hot", label: "Water in (hot)", unit: "°C", placeholder: "e.g. 35" },
  { id: "cold", label: "Water out (cold)", unit: "°C", placeholder: "e.g. 29.5" },
  { id: "wetBulb", label: "Wet bulb", unit: "°C", placeholder: "e.g. 25.5" },
];

const FILTER_FIELDS: { id: DutyField; label: string; unit: string; placeholder: string }[] = [
  { id: "cells", label: "No. of cells", unit: "#", placeholder: "Any" },
  { id: "maxLengthMm", label: "Space: length (approx.)", unit: "mm", placeholder: "Any" },
  { id: "maxWidthMm", label: "Space: width (approx.)", unit: "mm", placeholder: "Any" },
];

/** The first number in a typed or scanned value ("106.76 L/s" -> 106.76). */
const numberIn = (value: string) => {
  const match = /-?\d[\d,]*(\.\d+)?/.exec(value);
  return match ? Number(match[0].replace(/,/g, "")) : undefined;
};

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init.headers } });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Something went wrong.");
  return response.json() as Promise<T>;
}

/** A maker's name guessed from a file name: "CTI_49_SI_10April2026 - Evapco.pdf" -> "Evapco". */
function makerFromFile(name: string): string {
  const base = name.replace(/\.[a-z]+$/i, "");
  const afterDash = base.split(/\s+-\s+/).pop() ?? base;
  return afterDash.replace(/^CTI[_\s\d]*SI[_\s\d\w]*$/i, "").trim();
}

export function TowerSelector() {
  const [infos, setInfos] = useState<MakerTableInfo[] | null>(null);
  const [tables, setTables] = useState<Record<string, MakerTable>>({});
  const [values, setValues] = useState<Record<DutyField, string>>({
    flow: "",
    hot: "",
    cold: "",
    wetBulb: "",
    motorKw: "",
    cells: "",
    maxLengthMm: "",
    maxWidthMm: "",
  });
  const [motorMatch, setMotorMatch] = useState<Duty["motorMatch"]>("exact");
  /** Spare capacity the recommended tower must have, in %. */
  const [minMargin, setMinMargin] = useState("5");
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [pending, setPending] = useState<{ fileName: string; table: CtiTable; maker: string; series: string } | null>(
    null
  );
  const rfqRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const { tables: list } = await call<{ tables: MakerTableInfo[] }>("/api/selector");
      setInfos(list);
      const loaded = await Promise.all(
        list.map((info) => call<{ table: MakerTable }>(`/api/selector/${info.id}`).then((r) => r.table))
      );
      setTables(Object.fromEntries(loaded.map((table) => [table.id, table])));
    } catch (err) {
      setInfos([]);
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Could not load the maker tables." });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const duty: Partial<Duty> = {
    flow: numberIn(values.flow),
    hot: numberIn(values.hot),
    cold: numberIn(values.cold),
    wetBulb: numberIn(values.wetBulb),
    motorKw: numberIn(values.motorKw),
    motorMatch,
    cells: numberIn(values.cells),
    maxLengthMm: numberIn(values.maxLengthMm),
    maxWidthMm: numberIn(values.maxWidthMm),
  };
  const problem = dutyProblem(duty);
  // A CTI doc that's attached but not saved yet is used straight away.
  const loadedTables = useMemo(
    () => [
      ...Object.values(tables),
      ...(pending
        ? [
            {
              ...pending.table,
              id: "attached",
              maker: pending.maker.trim() || "Attached CTI doc",
              series: pending.series,
              fileName: pending.fileName,
              addedAt: "",
            },
          ]
        : []),
    ],
    [tables, pending]
  );

  const margin = numberIn(minMargin) ?? 0;
  const results = useMemo(
    () =>
      problem || loadedTables.length === 0
        ? []
        : rankTowers(selectTowers(loadedTables, duty as Duty), duty as Duty, margin),
    // The duty is rebuilt from `values` each render; recompute when they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [problem, loadedTables, values, motorMatch, margin]
  );
  const recommendation = useMemo(() => recommend(results, margin), [results, margin]);

  const set = (id: DutyField, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
    setShown(PAGE);
  };

  /** Fills the duty from an RFQ, bid form or spec (read in the browser, nothing is uploaded). */
  async function scanRfq(file: File) {
    setBusy("rfq");
    setMessage(null);
    try {
      const result = parseScan(toLines(await readDocument(file, () => {})));
      const found: Partial<Record<DutyField, string>> = {};
      const take = (id: DutyField, value?: string) => {
        if (value?.trim() && numberIn(value) !== undefined) found[id] = String(numberIn(value));
      };
      take("flow", result.condenserFlowRate?.value);
      take("hot", result.condInTemp?.value);
      take("cold", result.condOutTemp?.value);
      take("wetBulb", result.wetBulbTemp?.value);
      take("motorKw", result.fanKw?.value);
      take("cells", result.numberOfCells?.value);
      const [length, width] = (result.dimensions?.value ?? "").match(/\d[\d,]*/g)?.map((d) => d.replace(/,/g, "")) ?? [];
      if (length && width) {
        found.maxLengthMm = length;
        found.maxWidthMm = width;
      }
      const filled = Object.keys(found).length;
      setValues((prev) => ({ ...prev, ...found }));
      setShown(PAGE);
      setMessage(
        filled
          ? { tone: "info", text: `Filled ${filled} ${filled === 1 ? "value" : "values"} from ${file.name}. Check them against the document.` }
          : { tone: "error", text: `No duty values were found in ${file.name}.` }
      );
    } catch (err) {
      console.error(err);
      setMessage({ tone: "error", text: "The document couldn't be read." });
    } finally {
      setBusy(null);
    }
  }

  /** Reads a maker's CTI performance table PDF in the browser, ready to name and save. */
  async function readTable(file: File) {
    setBusy("table");
    setMessage(null);
    try {
      const table = parseCtiTable(await readDocument(file, () => {}));
      setPending({ fileName: file.name, table, maker: makerFromFile(file.name), series: "" });
    } catch (err) {
      console.error(err);
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "The table couldn't be read." });
    } finally {
      setBusy(null);
    }
  }

  async function saveTable() {
    if (!pending?.maker.trim()) return;
    setBusy("save");
    try {
      await call("/api/selector", {
        method: "POST",
        body: JSON.stringify({ maker: pending.maker, series: pending.series, fileName: pending.fileName, ...pending.table }),
      });
      setMessage({ tone: "info", text: `Saved ${pending.table.models.length} ${pending.maker} models.` });
      setPending(null);
      await refresh();
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Could not save the table." });
    } finally {
      setBusy(null);
    }
  }

  async function removeTable(info: MakerTableInfo) {
    if (!window.confirm(`Delete the ${info.maker} ${info.series} table? You can upload it again later.`)) return;
    setBusy(info.id);
    try {
      await call(`/api/selector/${info.id}`, { method: "DELETE" });
      await refresh();
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Could not delete the table." });
    } finally {
      setBusy(null);
    }
  }

  const range = duty.hot !== undefined && duty.cold !== undefined ? duty.hot - duty.cold : undefined;
  const approach = duty.cold !== undefined && duty.wetBulb !== undefined ? duty.cold - duty.wetBulb : undefined;
  const fmt = (n: number, digits = 1) => n.toLocaleString("en-AU", { maximumFractionDigits: digits });

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="grid-cols-[minmax(0,1fr)_auto]">
          <CardTitle>Duty</CardTitle>
          <CardDescription className="col-start-1">
            From the RFQ. Range and approach are worked out from the temperatures.
          </CardDescription>
          <div className="col-start-2 row-span-2 row-start-1 self-start">
            <Button type="button" variant="outline" size="sm" disabled={!!busy} onClick={() => rfqRef.current?.click()}>
              {busy === "rfq" ? <Loader2 className="animate-spin" /> : <ScanLine />} Scan RFQ
            </Button>{" "}
            <Button type="button" variant="outline" size="sm" disabled={!!busy} onClick={() => tableRef.current?.click()}>
              {busy === "table" ? <Loader2 className="animate-spin" /> : <FileUp />} Attach CTI doc
            </Button>
            <input
              ref={rfqRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void scanRfq(file);
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {DUTY_FIELDS.map(({ id, label, unit, placeholder }) => (
              <div key={id} className="grid content-start gap-1.5">
                <Label htmlFor={`duty-${id}`}>
                  {label} <span className="text-muted-foreground text-xs font-normal">{unit}</span>
                </Label>
                <Input
                  id={`duty-${id}`}
                  inputMode="decimal"
                  placeholder={placeholder}
                  value={values[id]}
                  onChange={(event) => set(id, event.target.value)}
                />
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-sm">
            Range{" "}
            <span className="text-foreground font-medium">{range !== undefined ? `${fmt(range, 2)} °C` : "–"}</span> ·
            Approach{" "}
            <span className="text-foreground font-medium">{approach !== undefined ? `${fmt(approach, 2)} °C` : "–"}</span>
          </p>
          <p className="text-muted-foreground border-t pt-4 text-sm">
            Optional and approximate: the tower closest to these is picked. Leave them blank for a compact tower with a
            low motor power.
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="grid content-start gap-1.5">
              <Label htmlFor="duty-motorKw">
                Motor per fan (approx.) <span className="text-muted-foreground text-xs font-normal">kW</span>
              </Label>
              <div className="flex">
                <Input
                  id="duty-motorKw"
                  inputMode="decimal"
                  placeholder="Any"
                  className="rounded-r-none"
                  value={values.motorKw}
                  onChange={(event) => set("motorKw", event.target.value)}
                />
                <NativeSelect
                  aria-label="Motor match"
                  className="-ml-px w-auto rounded-l-none"
                  value={motorMatch}
                  onChange={(event) => {
                    setMotorMatch(event.target.value as Duty["motorMatch"]);
                    setShown(PAGE);
                  }}
                >
                  <option value="exact">about</option>
                  <option value="max">or less</option>
                </NativeSelect>
              </div>
            </div>
            {FILTER_FIELDS.map(({ id, label, unit, placeholder }) => (
              <div key={id} className="grid content-start gap-1.5">
                <Label htmlFor={`duty-${id}`}>
                  {label} <span className="text-muted-foreground text-xs font-normal">{unit}</span>
                </Label>
                <Input
                  id={`duty-${id}`}
                  inputMode="decimal"
                  placeholder={placeholder}
                  value={values[id]}
                  onChange={(event) => set(id, event.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="grid gap-1.5 sm:max-w-xs">
            <Label htmlFor="duty-minMargin">
              Minimum spare capacity <span className="text-muted-foreground text-xs font-normal">%</span>
            </Label>
            <Input
              id="duty-minMargin"
              inputMode="decimal"
              value={minMargin}
              onChange={(event) => setMinMargin(event.target.value)}
            />
          </div>
          {message && (
            <p
              className={cn(
                "flex gap-2 rounded-md border px-3 py-2 text-sm",
                message.tone === "error"
                  ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
                  : "bg-muted/50"
              )}
            >
              {message.tone === "error" && <TriangleAlert className="mt-0.5 size-4 shrink-0" />} {message.text}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tower to use</CardTitle>
          <CardDescription>
            The best match for the duty and the numbers typed. Motor and plan size come from the model name (nominal,
            rounded up to whole feet).
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {infos === null ? (
            <p className="text-muted-foreground flex items-center gap-2 px-6 text-sm">
              <Loader2 className="size-4 animate-spin" /> Loading maker tables…
            </p>
          ) : loadedTables.length === 0 ? (
            <p className="text-muted-foreground px-6 text-sm">Type the duty and attach a maker&apos;s CTI doc (“Attach CTI doc” above) to get the tower.</p>
          ) : problem ? (
            <p className="text-muted-foreground px-6 text-sm">{problem}</p>
          ) : results.length === 0 ? (
            <p className="text-muted-foreground px-6 text-sm">
              No model in the attached tables cools this duty.
            </p>
          ) : (
            <>
            <RecommendationPanel recommendation={recommendation} minMargin={margin} duty={duty as Duty} />
            <p className="px-6 pb-2 text-sm font-semibold">Every tower that cools the duty, best match first</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs">
                    <th className="px-6 py-2 font-medium">Model</th>
                    <th className="px-2 py-2 text-right font-medium">Cools (L/s)</th>
                    <th className="px-2 py-2 text-right font-medium">Margin</th>
                    <th className="px-2 py-2 font-medium">Motor per fan</th>
                    <th className="px-2 py-2 text-right font-medium">Cells</th>
                    <th className="px-2 py-2 font-medium">Plan (L × W mm)</th>
                    <th className="px-6 py-2 font-medium">Nearest certified point</th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, shown).map((c) => {
                    const near = c.estimate.nearest;
                    return (
                      <tr key={`${c.tableId}/${c.model}`} className="border-b last:border-b-0">
                        <td className="px-6 py-2">
                          <p className="font-medium">{c.model}</p>
                          <p className="text-muted-foreground text-xs">
                            {[c.maker, c.series].filter(Boolean).join(" · ")}
                          </p>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{fmt(c.estimate.flow)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          +{fmt(c.margin)}%
                          {c.estimate.extrapolated && (
                            <span
                              className="ml-1 text-amber-600 dark:text-amber-400"
                              title="The duty is outside this model's certified conditions: less reliable"
                            >
                              *
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {c.details?.motorKw ? `${c.details.motorKw} kW (${c.details.motorHp} HP)` : "–"}
                        </td>
                        <td className="px-2 py-2 text-right">{c.details?.cells ?? "–"}</td>
                        <td className="px-2 py-2 tabular-nums">
                          {c.details ? `${fmt(c.details.lengthMm, 0)} × ${fmt(c.details.widthMm, 0)}` : "–"}
                        </td>
                        <td className="text-muted-foreground px-6 py-2 text-xs">
                          #{near.index + 1}: WB {near.condition.wetBulb} · R {near.condition.range} · A{" "}
                          {near.condition.approach} → {near.flow} L/s
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 px-6 pt-3 text-xs">
                <span>
                  {results.length} {results.length === 1 ? "model" : "models"} ·{" "}
                  <span className="text-amber-600 dark:text-amber-400">*</span> outside the certified conditions
                </span>
                {results.length > shown && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE)}>
                    Show more
                  </Button>
                )}
              </div>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="grid-cols-[minmax(0,1fr)_auto]">
          <CardTitle>Maker tables</CardTitle>
          <CardDescription className="col-start-1">
            Each maker&apos;s CTI certified performance table (the CTI_49 SI PDF, flows in L/s). Read in your browser,
            then stored for the selector.
          </CardDescription>
          <div className="col-start-2 row-span-2 row-start-1 self-start">
            <Button type="button" variant="outline" size="sm" disabled={!!busy} onClick={() => tableRef.current?.click()}>
              {busy === "table" ? <Loader2 className="animate-spin" /> : <FileUp />} Add table
            </Button>
            <input
              ref={tableRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void readTable(file);
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {pending && (
            <div className="grid gap-3 rounded-lg border p-3">
              <p className="text-sm">
                <span className="font-medium">{pending.fileName}</span>: {pending.table.models.length} models,{" "}
                {pending.table.conditions.length} rating conditions. Already used for the tower above; save it to keep it for
                next time.
              </p>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div className="grid gap-1.5">
                  <Label htmlFor="pending-maker">Maker</Label>
                  <Input
                    id="pending-maker"
                    placeholder="e.g. Evapco"
                    value={pending.maker}
                    onChange={(event) => setPending({ ...pending, maker: event.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="pending-series">Series (optional)</Label>
                  <Input
                    id="pending-series"
                    placeholder="e.g. AT / UT / USS"
                    value={pending.series}
                    onChange={(event) => setPending({ ...pending, series: event.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setPending(null)}>
                    Cancel
                  </Button>
                  <Button type="button" disabled={!pending.maker.trim() || busy === "save"} onClick={() => void saveTable()}>
                    {busy === "save" && <Loader2 className="animate-spin" />} Save
                  </Button>
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                Saving under the same maker and series replaces that table.
              </p>
            </div>
          )}
          {infos && infos.length > 0 ? (
            <ul className="divide-y rounded-lg border">
              {infos.map((info) => (
                <li key={info.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium">{[info.maker, info.series].filter(Boolean).join(" · ")}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {info.modelCount} models · {info.fileName} · added {dateFormat.format(new Date(info.addedAt))}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete the ${info.maker} table`}
                    disabled={!!busy}
                    onClick={() => void removeTable(info)}
                  >
                    {busy === info.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            infos && !pending && <p className="text-muted-foreground text-sm">No maker tables yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const fmtNumber = (n: number, digits = 1) => n.toLocaleString("en-AU", { maximumFractionDigits: digits });

function Pick({ label, candidate, highlight }: { label: string; candidate: Candidate; highlight?: boolean }) {
  const kw = totalKw(candidate);
  const area = planArea(candidate);
  const d = candidate.details;
  return (
    <div className={cn("grid content-start gap-1 rounded-lg border p-3", highlight && "border-primary bg-primary/5")}>
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      <p className={cn("font-semibold", highlight ? "text-xl" : "text-base")}>{candidate.model}</p>
      <p className="text-muted-foreground text-xs">{[candidate.maker, candidate.series].filter(Boolean).join(" · ")}</p>
      <p className="text-sm">
        Cools <span className="font-medium">{fmtNumber(candidate.estimate.flow)} L/s</span> (+{fmtNumber(candidate.margin)}%)
        {candidate.estimate.extrapolated && <span className="text-amber-600 dark:text-amber-400"> *</span>}
      </p>
      {d && (
        <p className="text-sm">
          {d.cells} {d.cells === 1 ? "cell" : "cells"}
          {d.motorKw !== undefined && ` · ${d.cells > 1 ? `${d.cells} × ` : ""}${d.motorKw} kW${d.cells > 1 && kw ? ` (${fmtNumber(kw)} kW)` : ""}`}
          {area !== undefined && ` · ${fmtNumber(d.lengthMm, 0)} × ${fmtNumber(d.widthMm, 0)} mm`}
        </p>
      )}
    </div>
  );
}

/** The tower to use for the duty, with the smallest and lowest power alternatives when they differ. */
function RecommendationPanel({
  recommendation,
  minMargin,
  duty,
}: {
  recommendation: ReturnType<typeof recommend>;
  minMargin: number;
  duty: Duty;
}) {
  if (!recommendation) {
    return (
      <p className="mx-6 mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
        No tower has {fmtNumber(minMargin)}% spare capacity. Lower the minimum spare capacity; the list below shows what
        does cool the duty.
      </p>
    );
  }
  const { best, smallest, lowestPower } = recommendation;
  return (
    <div className="mx-6 mb-4 grid gap-3">
      <div className="grid gap-3 md:grid-cols-[1.3fr_1fr_1fr]">
        <div className="grid gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Award className="text-primary size-4" /> Use this tower
          </p>
          <Pick label={`Best match · ≥ ${fmtNumber(minMargin)}% spare`} candidate={best} highlight />
          {matchNotes(best, duty).length > 0 && (
            <ul className="text-muted-foreground grid gap-0.5 text-xs">
              {matchNotes(best, duty).map((note) => (
                <li key={note}>• {note}</li>
              ))}
            </ul>
          )}
        </div>
        {smallest && <Pick label="Alternative: smallest plan" candidate={smallest} />}
        {lowestPower && <Pick label="Alternative: lowest motor power" candidate={lowestPower} />}
      </div>
      <p className="text-muted-foreground text-xs">
        Estimated from the CTI certified points (nearest: #{best.estimate.nearest.index + 1} WB{" "}
        {best.estimate.nearest.condition.wetBulb} · R {best.estimate.nearest.condition.range} · A{" "}
        {best.estimate.nearest.condition.approach} → {best.estimate.nearest.flow} L/s). Confirm in TruWise before quoting.
      </p>
    </div>
  );
}
