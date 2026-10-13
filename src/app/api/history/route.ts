import { gzipSync } from "node:zlib";
import { del, list, put } from "@vercel/blob";

import { historyTitle, projectKey, restoreProposal, type ProjectEntry } from "@/lib/history";
import { decodeTitle, encodeTitle, PROJECTS_PREFIX, projectId, projectPath } from "@/lib/history-server";
import type { ProposalData } from "@/lib/proposal";

export const dynamic = "force-dynamic";

/** Every saved file under `prefix`. */
async function listAll(prefix: string) {
  const blobs: { pathname: string; uploadedAt: Date }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

/** GET /api/history – saved projects, newest first. */
export async function GET() {
  const entries: ProjectEntry[] = (await listAll(PROJECTS_PREFIX)).map((blob) => {
    const id = projectId(blob.pathname);
    return { id, title: decodeTitle(id.slice(id.indexOf("_") + 1)), savedAt: new Date(blob.uploadedAt).toISOString() };
  });
  entries.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return Response.json({ entries });
}

/**
 * POST /api/history – body { data }: saves the whole form, compressed, as the project's latest version. A project
 * is its TTA quote number, so saving again replaces it (and any older copy saved under another project name).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { data?: ProposalData } | null;
  if (!body || typeof body.data !== "object" || body.data === null) {
    return Response.json({ error: "Nothing to save." }, { status: 400 });
  }
  // Fill in any missing fields first, so an incomplete form still gets a name.
  const data = restoreProposal(body.data);
  const key = projectKey(data.quoteNumber);
  if (!key) return Response.json({ error: "Fill in the TTA Quote Number first." }, { status: 400 });

  const title = historyTitle(data);
  const id = `${key}_${encodeTitle(title)}`;
  const pathname = projectPath(id);
  await put(pathname, gzipSync(JSON.stringify(body.data)), {
    access: "private",
    contentType: "application/gzip",
    allowOverwrite: true,
  });
  // The same quote saved under an older project name.
  const older = (await listAll(`${PROJECTS_PREFIX}${key}_`)).filter((blob) => blob.pathname !== pathname);
  if (older.length) await del(older.map((blob) => blob.pathname));

  const entry: ProjectEntry = { id, title, savedAt: new Date().toISOString() };
  return Response.json({ entry });
}
