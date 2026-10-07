"use client";

import { useEffect, useRef, useState } from "react";
import { FileDown, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

/** A generated document waiting to be previewed, then downloaded as-is. */
export type PreviewDocument = { label: string; blob: Blob; fileName: string };

type DocumentPreviewProps = {
  document: PreviewDocument | null;
  onDownload: (document: PreviewDocument) => void;
  onClose: () => void;
};

/**
 * Shows the generated Word file page by page before it's downloaded. The preview is drawn in the
 * browser, so fonts and spacing can differ slightly from Word; the download is the exact same file.
 */
export function DocumentPreview({ document: doc, onDownload, onClose }: DocumentPreviewProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (doc && !dialog.open) dialog.showModal();
    if (!doc && dialog.open) dialog.close();
  }, [doc]);

  useEffect(() => {
    const container = pagesRef.current;
    if (!doc || !container) return;
    let cancelled = false;
    setStatus("loading");
    container.replaceChildren();
    // Loaded on first use so the library isn't in every page's bundle.
    import("docx-preview")
      .then(({ renderAsync }) => renderAsync(doc.blob, container, container, { className: "docx", inWrapper: true }))
      .then(() => !cancelled && setStatus("ready"))
      .catch((err) => {
        console.error(err);
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  const close = () => dialogRef.current?.close();

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      // A click on the dimmed backdrop lands on the dialog element itself.
      onClick={(event) => event.target === dialogRef.current && close()}
      aria-labelledby="document-preview-title"
      className="bg-background text-foreground m-auto h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-5xl rounded-xl border p-0 shadow-xl backdrop:bg-black/50"
    >
      {doc && (
        <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto]">
          <div className="flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <h2 id="document-preview-title" className="font-semibold">
                Preview: {doc.label}
              </h2>
              <p className="text-muted-foreground truncate text-sm">{doc.fileName}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Close" onClick={close}>
              <X />
            </Button>
          </div>

          <div className="relative overflow-auto bg-neutral-500">
            {status === "loading" && (
              <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white">
                <Loader2 className="size-4 animate-spin" /> Loading preview…
              </p>
            )}
            {status === "error" && (
              <p className="m-4 rounded-md bg-white p-3 text-sm text-neutral-900">
                The preview couldn&apos;t be shown, but the document can still be downloaded.
              </p>
            )}
            <div ref={pagesRef} />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3 sm:px-6">
            <p className="text-muted-foreground mr-auto text-xs">
              Layout can differ slightly from Word. The download is the same document.
            </p>
            <Button type="button" variant="outline" onClick={close}>
              Back to editing
            </Button>
            <Button type="button" onClick={() => onDownload(doc)}>
              <FileDown /> Download
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
