"use client";

import { useRef, useState } from "react";
import { Loader2, ScanLine, TriangleAlert, X } from "lucide-react";

import { MAX_TOWER_TYPES, type ProposalData } from "@/lib/proposal";
import { SCAN_FIELDS, applyScan, canApply, currentScanValue, isUntouched, type ScanField } from "@/lib/scan-fields";
import { parseScan, toLines, type ScanFieldId, type ScanResult } from "@/lib/scan-parse";
import { readDocument } from "@/lib/scan-source";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

/** What a scan filled: the file, the tower type it went into and the fields applied. */
export type AppliedScan = { fileName: string; towerIndex: number; filled: ScanFieldId[] };

type ScanDocumentButtonProps = {
  data: ProposalData;
  onApply: (next: ProposalData, scan: AppliedScan) => void;
};

type Target = number | "new";

type State =
  | { phase: "idle" }
  | { phase: "reading"; fileName: string; step: string }
  | { phase: "error"; fileName: string; message: string }
  | { phase: "review"; fileName: string; result: ScanResult };

/** The first tower type with an empty specification, else a new one (or tower type 1 when full). */
function defaultTarget(data: ProposalData): Target {
  const specs = [data.spec, ...data.extraSpecs];
  const empty = specs.findIndex((spec) => Object.values(spec).every((value) => !value.trim()));
  if (empty >= 0) return empty;
  return specs.length < MAX_TOWER_TYPES ? "new" : 0;
}

/**
 * "Scan Document" button: reads a bid form, spec or scan in the browser (nothing is uploaded), then lists
 * what it found so each value can be checked, corrected and applied to the form.
 */
export function ScanDocumentButton({ data, onApply }: ScanDocumentButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ phase: "idle" });
  const [target, setTarget] = useState<Target>(0);
  const [values, setValues] = useState<Partial<Record<ScanFieldId, string>>>({});
  const [checked, setChecked] = useState<Set<ScanFieldId>>(new Set());

  const towerCount = 1 + data.extraSpecs.length;
  const targetIndex = target === "new" ? towerCount : target;
  const current = (id: ScanFieldId) => (target === "new" && SCAN_FIELDS.find((f) => f.id === id)?.group === "tower" ? "" : currentScanValue(data, id, targetIndex));

  /**
   * Ticks every found value that wouldn't replace something already typed differently. Starting values
   * (like the SS316 scope defaults) don't count as typed.
   */
  const defaultChecks = (result: ScanResult, to: Target) =>
    new Set(
      SCAN_FIELDS.filter(({ id, group }) => {
        const found = result[id]?.value;
        if (!found || !canApply(data, id)) return false;
        if (to === "new" && group === "tower") return true;
        const index = to === "new" ? towerCount : to;
        return isUntouched(data, id, index) || currentScanValue(data, id, index).trim() === found;
      }).map(({ id }) => id)
    );

  async function scan(file: File) {
    setState({ phase: "reading", fileName: file.name, step: "Opening…" });
    dialogRef.current?.showModal();
    try {
      const pages = await readDocument(file, ({ step }) =>
        setState((prev) => (prev.phase === "reading" ? { ...prev, step } : prev))
      );
      // Closed while reading: drop the result.
      if (!dialogRef.current?.open) return;
      const result = parseScan(toLines(pages));
      if (Object.keys(result).length === 0) {
        setState({
          phase: "error",
          fileName: file.name,
          message: "No RFQ values were found in this document. Check it's the bid form or spec, or that a scan is sharp and upright.",
        });
        return;
      }
      const to = defaultTarget(data);
      setTarget(to);
      setValues(Object.fromEntries(Object.entries(result).map(([id, finding]) => [id, finding!.value])));
      setChecked(defaultChecks(result, to));
      setState({ phase: "review", fileName: file.name, result });
    } catch (err) {
      console.error(err);
      setState({ phase: "error", fileName: file.name, message: "The document couldn't be read. Try another copy of the file." });
    }
  }

  const close = () => dialogRef.current?.close();

  function apply() {
    if (state.phase !== "review") return;
    const filled = [...checked].filter((id) => values[id]?.trim());
    const chosen = Object.fromEntries(filled.map((id) => [id, values[id] ?? ""]));
    onApply(applyScan(data, chosen, target), { fileName: state.fileName, towerIndex: targetIndex, filled });
    close();
  }

  const row = (field: ScanField, result: ScanResult) => {
    const finding = result[field.id];
    if (!finding || !canApply(data, field.id)) return null;
    const now = current(field.id);
    const isChecked = checked.has(field.id);
    const toggle = () =>
      setChecked((prev) => {
        const next = new Set(prev);
        if (next.has(field.id)) next.delete(field.id);
        else next.add(field.id);
        return next;
      });
    return (
      <div
        key={field.id}
        className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-t py-2 first:border-t-0 sm:grid-cols-[auto_minmax(0,14rem)_minmax(0,1fr)]"
      >
        <input
          type="checkbox"
          className="accent-primary mt-2 size-4"
          aria-label={`Fill ${field.label}`}
          checked={isChecked}
          onChange={toggle}
        />
        <div className="min-w-0 pt-1.5">
          <p className="text-sm font-medium leading-snug">{field.label}</p>
          <p className="text-muted-foreground truncate text-xs" title={finding.source}>
            {finding.source}
          </p>
        </div>
        <div className="col-start-2 min-w-0 sm:col-start-3">
          {field.options ? (
            <NativeSelect
              aria-label={field.label}
              className="h-8 md:text-sm"
              value={values[field.id] ?? ""}
              onChange={(event) => setValues((prev) => ({ ...prev, [field.id]: event.target.value }))}
            >
              {field.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </NativeSelect>
          ) : (
            <Input
              aria-label={field.label}
              className="h-8 md:text-sm"
              value={values[field.id] ?? ""}
              onChange={(event) => setValues((prev) => ({ ...prev, [field.id]: event.target.value }))}
            />
          )}
          {now.trim() && now.trim() !== (values[field.id] ?? "").trim() && (
            <p className={cn("mt-1 text-xs", isChecked ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
              {isChecked ? "Replaces" : "Keeping"} “{now}”
            </p>
          )}
        </div>
      </div>
    );
  };

  const missing = state.phase === "review" ? SCAN_FIELDS.filter((field) => !state.result[field.id]) : [];

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
        <ScanLine /> Scan Document
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void scan(file);
        }}
      />
      <dialog
        ref={dialogRef}
        onClose={() => setState({ phase: "idle" })}
        onClick={(event) => event.target === dialogRef.current && state.phase !== "reading" && close()}
        aria-labelledby="scan-title"
        className="bg-background text-foreground m-auto w-[calc(100%-2rem)] max-w-3xl rounded-xl border p-0 shadow-xl backdrop:bg-black/50"
      >
        {state.phase !== "idle" && (
          <div className="grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto]">
            <div className="flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <h2 id="scan-title" className="font-semibold">
                  Scan Document
                </h2>
                <p className="text-muted-foreground truncate text-sm">{state.fileName}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Close" onClick={close}>
                <X />
              </Button>
            </div>

            <div className="overflow-y-auto px-4 py-4 sm:px-6">
              {state.phase === "reading" && (
                <p className="flex items-center gap-2 py-8 text-sm">
                  <Loader2 className="size-4 animate-spin" /> {state.step}
                </p>
              )}
              {state.phase === "error" && (
                <p className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {state.message}
                </p>
              )}
              {state.phase === "review" && (
                <div className="grid gap-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <label htmlFor="scan-target" className="text-sm font-medium">
                      Fill tower values into
                    </label>
                    <NativeSelect
                      id="scan-target"
                      className="h-8 w-auto md:text-sm"
                      value={String(target)}
                      onChange={(event) => {
                        const to: Target = event.target.value === "new" ? "new" : Number(event.target.value);
                        setTarget(to);
                        setChecked(defaultChecks(state.result, to));
                      }}
                    >
                      {Array.from({ length: towerCount }, (_, i) => (
                        <option key={i} value={i}>
                          Tower Type {i + 1}
                        </option>
                      ))}
                      {towerCount < MAX_TOWER_TYPES && <option value="new">New tower type</option>}
                    </NativeSelect>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Check each value against the document. Ticked values are filled in; values that would replace
                    something already typed start unticked.
                  </p>
                  {(["project", "tower", "scope"] as const).map((group) => {
                    const rows = SCAN_FIELDS.filter((field) => field.group === group).map((field) => row(field, state.result));
                    return rows.some(Boolean) ? (
                      <section key={group}>
                        <h3 className="mb-1 text-sm font-semibold">
                          {group === "project"
                            ? "Project & contact"
                            : group === "tower"
                              ? "Cooling tower specification"
                              : "Commercial Proposal · Scope of Supply (all tower types)"}
                        </h3>
                        <div>{rows}</div>
                      </section>
                    ) : null;
                  })}
                  {missing.length > 0 && (
                    <p className="text-muted-foreground text-xs">
                      Not found in the document: {missing.map((field) => field.label).join(", ")}.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3 sm:px-6">
              <p className="text-muted-foreground mr-auto text-xs">Read in your browser. The document isn&apos;t uploaded.</p>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              {state.phase === "review" && (
                <Button type="button" disabled={checked.size === 0} onClick={apply}>
                  Fill {checked.size} {checked.size === 1 ? "value" : "values"}
                </Button>
              )}
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
