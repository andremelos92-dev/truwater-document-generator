"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Copy, Mail, TriangleAlert, X } from "lucide-react";

import { projectTitle, resolvedCommercialTowers, towerSpec, type ProposalData, type SummaryExtra } from "@/lib/proposal";
import {
  autoShape,
  buildSelectionSummary,
  selectionSummaryHtml,
  selectionSummaryText,
  summaryExtra,
  type SummaryAttachments,
} from "@/lib/selection-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

type SelectionSummaryButtonProps = {
  data: ProposalData;
  onExtrasChange: (selectionSummary: SummaryExtra[]) => void;
  className?: string;
};

const SHAPES = ["Square", "Rectangular", "Round"];

/**
 * "Selection Summary" button: previews the email summary built from the forms, then copies it as
 * formatted text (the table survives pasting into Outlook) or opens an email draft to the contact.
 */
export function SelectionSummaryButton({ data, onExtrasChange, className }: SelectionSummaryButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [attach, setAttach] = useState<SummaryAttachments>({ technical: true, commercial: true });

  const summary = useMemo(() => buildSelectionSummary(data, attach), [data, attach]);
  const html = useMemo(() => selectionSummaryHtml(summary), [summary]);
  const towers = resolvedCommercialTowers(data);
  const missing = [
    ...(summary.missing.length ? [summary.missing.join(", ")] : []),
    ...summary.towers.flatMap((tower, index) =>
      tower.missing.length
        ? [`${summary.towers.length > 1 ? `Tower type ${index + 1}: ` : ""}${tower.missing.join(", ")}`]
        : []
    ),
  ];

  const setExtra = (index: number, update: Partial<SummaryExtra>) => {
    const next = towers.map((_, i) => summaryExtra(data, i));
    next[index] = { ...next[index], ...update };
    onExtrasChange(next);
    setCopied(false);
  };

  const show = () => {
    setCopied(false);
    setOpen(true);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  async function copy(): Promise<boolean> {
    const text = selectionSummaryText(summary);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
    } catch {
      // Older browsers: copy the rendered preview through a selection instead.
      const node = previewRef.current;
      const selection = window.getSelection();
      if (!node || !selection) return false;
      const range = document.createRange();
      range.selectNodeContents(node);
      selection.removeAllRanges();
      selection.addRange(range);
      const ok = document.execCommand("copy");
      selection.removeAllRanges();
      if (!ok) return false;
    }
    setCopied(true);
    return true;
  }

  async function copyAndEmail() {
    await copy();
    const subject = [projectTitle(data), "Selection Summary"].filter(Boolean).join(" – ");
    const to = data.contactEmail.trim();
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}`;
  }

  return (
    <>
      <Button type="button" size="lg" variant="outline" className={className} onClick={show}>
        <Mail /> Selection Summary
      </Button>
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        // A click on the dimmed backdrop lands on the dialog element itself.
        onClick={(event) => event.target === dialogRef.current && close()}
        aria-labelledby="selection-summary-title"
        className="bg-background text-foreground m-auto w-[calc(100%-2rem)] max-w-3xl rounded-xl border p-0 shadow-xl backdrop:bg-black/50"
      >
        {open && (
          <div className="grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto]">
            <div className="flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <h2 id="selection-summary-title" className="font-semibold">
                  Selection Summary
                </h2>
                <p className="text-muted-foreground text-sm">
                  Built from the forms. Copy it, then paste into your email.
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Close" onClick={close}>
                <X />
              </Button>
            </div>

            <div className="grid content-start gap-4 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <p className="text-sm font-medium">Attached</p>
                {(
                  [
                    ["technical", "Technical Proposal"],
                    ["commercial", "Commercial Proposal"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-primary size-4"
                      checked={attach[key]}
                      onChange={(event) => {
                        setAttach((prev) => ({ ...prev, [key]: event.target.checked }));
                        setCopied(false);
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>

              {/* The few details the email needs that aren't typed anywhere else. */}
              <div className="grid gap-2">
                <p className="text-sm font-medium">
                  Extra details <span className="text-muted-foreground font-normal">· only used in this summary</span>
                </p>
                {towers.map((tower, index) => {
                  const extra = summaryExtra(data, index);
                  const derived = autoShape(towerSpec(data, index).dimensions);
                  return (
                    <div
                      key={index}
                      className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem_7rem_7rem_auto]"
                    >
                      <p className="col-span-2 truncate text-sm font-medium sm:col-span-1">
                        {tower.model || `Tower type ${index + 1}`}
                      </p>
                      <NativeSelect
                        aria-label="Shape"
                        className="h-8 md:text-sm"
                        value={extra.shape}
                        onChange={(event) => setExtra(index, { shape: event.target.value })}
                      >
                        <option value="">{derived ? `${derived} (auto)` : "Shape"}</option>
                        {SHAPES.map((shape) => (
                          <option key={shape} value={shape}>
                            {shape}
                          </option>
                        ))}
                      </NativeSelect>
                      <Input
                        aria-label="No. of air intakes"
                        placeholder="Air intakes"
                        inputMode="numeric"
                        className="h-8 md:text-sm"
                        value={extra.airIntakes}
                        onChange={(event) => setExtra(index, { airIntakes: event.target.value })}
                      />
                      <Input
                        aria-label="Approx. dry weight (kg)"
                        placeholder="Dry wt kg"
                        inputMode="decimal"
                        className="h-8 md:text-sm"
                        value={extra.dryWeight}
                        onChange={(event) => setExtra(index, { dryWeight: event.target.value })}
                      />
                      <label className="flex h-8 items-center gap-2 text-sm whitespace-nowrap">
                        <input
                          type="checkbox"
                          className="accent-primary size-4"
                          checked={extra.ctiCertified}
                          onChange={(event) => setExtra(index, { ctiCertified: event.target.checked })}
                        />
                        CTI Certified
                      </label>
                    </div>
                  );
                })}
              </div>

              {missing.length > 0 && (
                <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium">Still blank on the forms:</p>
                    {missing.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Shown exactly as it will paste: email styles on white paper, in light and dark mode. */}
              <div className="overflow-x-auto rounded-md border bg-white p-4 sm:p-5">
                <div ref={previewRef} dangerouslySetInnerHTML={{ __html: html }} />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3 sm:px-6">
              <p
                role="status"
                className={cn("mr-auto text-sm text-emerald-700 dark:text-emerald-400", !copied && "invisible")}
              >
                <Check className="mr-1 inline size-4" />
                Copied – paste into your email (Ctrl+V)
              </p>
              <Button type="button" variant="outline" onClick={() => void copyAndEmail()}>
                <Mail /> Copy &amp; open email
              </Button>
              <Button type="button" onClick={() => void copy()}>
                {copied ? <Check /> : <Copy />} Copy for email
              </Button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
