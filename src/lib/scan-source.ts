import type { TextItem } from "@/lib/scan-parse";

/** PDF pages read for text; long customer specs rarely have the tower data further in. */
const MAX_PAGES = 30;
/** Pages without a text layer that get OCR (slow, so only the first few). */
const MAX_OCR_PAGES = 4;
/** Fewer characters than this on a page means it's a scan or photo, so it needs OCR. */
const MIN_PAGE_TEXT = 40;

export type ScanProgress = { step: string };

type OcrWorker = Awaited<ReturnType<typeof import("tesseract.js").createWorker>>;

/** OCR words with their positions. Tesseract runs in the browser; the language data comes from its CDN. */
async function ocr(
  worker: OcrWorker,
  image: HTMLCanvasElement | File
): Promise<TextItem[]> {
  const { data } = await worker.recognize(image, {}, { blocks: true });
  return (data.blocks ?? []).flatMap((block) =>
    block.paragraphs.flatMap((paragraph) =>
      paragraph.lines.flatMap((line) =>
        line.words
          .filter((word) => word.confidence > 30)
          .map(({ text, bbox }) => ({
            text,
            x: bbox.x0,
            // Words on one line share the line's baseline, so they group together however tall they are.
            y: line.baseline.y0,
            width: bbox.x1 - bbox.x0,
            height: Math.max(line.rowAttributes.rowHeight * 0.7, bbox.y1 - bbox.y0),
          }))
      )
    )
  );
}

/** Reads every page of a PDF (or an image) as positioned text, using OCR where there's no text layer. */
export async function readDocument(file: File, onProgress: (progress: ScanProgress) => void): Promise<TextItem[][]> {
  let worker: OcrWorker | null = null;
  const getWorker = async () => {
    onProgress({ step: "Loading text recognition…" });
    const { createWorker } = await import("tesseract.js");
    worker ??= await createWorker("eng");
    return worker;
  };

  try {
    if (file.type.startsWith("image/")) {
      const w = await getWorker();
      onProgress({ step: "Recognising text in the image…" });
      return [await ocr(w, file)];
    }

    onProgress({ step: "Reading the PDF…" });
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;

    const pages: TextItem[][] = [];
    let ocrPages = 0;
    for (let number = 1; number <= Math.min(pdf.numPages, MAX_PAGES); number++) {
      const page = await pdf.getPage(number);
      const items = (await page.getTextContent()).items.flatMap((item) =>
        "str" in item && item.str.trim()
          ? [{
              text: item.str,
              x: item.transform[4],
              // PDF coordinates grow upwards; the parser reads top to bottom.
              y: -item.transform[5],
              width: item.width,
              height: item.height || Math.abs(item.transform[3]) || 8,
            }]
          : []
      );

      if (items.reduce((total, item) => total + item.text.trim().length, 0) >= MIN_PAGE_TEXT) {
        pages.push(items);
      } else if (ocrPages < MAX_OCR_PAGES) {
        ocrPages++;
        const w = await getWorker();
        onProgress({ step: `Recognising text on page ${number} of ${pdf.numPages} (scanned page)…` });
        // Four times the PDF size gives OCR enough detail for 6pt print (decimal points survive).
        const viewport = page.getViewport({ scale: 4 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, viewport }).promise;
        pages.push(await ocr(w, canvas));
      }
    }
    return pages;
  } finally {
    await (worker as OcrWorker | null)?.terminate();
  }
}
