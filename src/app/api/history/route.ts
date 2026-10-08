import { list, put } from "@vercel/blob";

import { historyTitle, isHistoryKind, restoreProposal, type HistoryEntry } from "@/lib/history";
import { decodeTitle, encodeTitle, entryPath } from "@/lib/history-server";
import type { ProposalData } from "@/lib/proposal";

export const dynamic = "force-dynamic";

/** GET /api/history?kind=rfq – the saved entries of one tab, newest first. */
export async function GET(request: Request) {
  const kind = new URL(request.url).searchParams.get("kind");
  if (!isHistoryKind(kind)) return Response.json({ error: "Unknown kind." }, { status: 400 });

  const entries: HistoryEntry[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: `history/${kind}/`, cursor });
    for (const blob of page.blobs) {
      const id = blob.pathname.slice(`history/${kind}/`.length).replace(/\.json$/, "");
      const encoded = id.slice(id.indexOf("_") + 1);
      entries.push({ id, kind, title: decodeTitle(encoded), savedAt: new Date(blob.uploadedAt).toISOString() });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  entries.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return Response.json({ entries });
}

/** POST /api/history – body { kind, data }: saves the whole form under that tab. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { kind?: unknown; data?: ProposalData } | null;
  if (!body || !isHistoryKind(body.kind) || typeof body.data !== "object" || body.data === null) {
    return Response.json({ error: "Nothing to save." }, { status: 400 });
  }

  // Fill in any missing fields first, so an incomplete form still gets a title.
  const title = historyTitle(restoreProposal(body.data));
  const id = `${Date.now()}_${encodeTitle(title)}`;
  await put(entryPath(body.kind, id), JSON.stringify(body.data), {
    access: "private",
    contentType: "application/json",
  });
  const entry: HistoryEntry = { id, kind: body.kind, title, savedAt: new Date().toISOString() };
  return Response.json({ entry });
}
