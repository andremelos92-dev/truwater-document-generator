import type { RecentSave } from "@/lib/history";
import { listVersions, noteOf, readNotes, type Notes } from "@/lib/history-server";

export const dynamic = "force-dynamic";

/** Saves shown on the dashboard. */
const RECENT = 8;

/** GET /api/history/recent – the latest saves across every project, newest first, with what changed. */
export async function GET() {
  const files = await listVersions();
  const latestOf = new Map(files.map((file) => [file.key, file.id])); // oldest first, so the last one wins
  const recent = files.slice(-RECENT).reverse();
  const notes = new Map<string, Notes>(
    await Promise.all([...new Set(recent.map((file) => file.key))].map(async (key) => [key, await readNotes(key)] as const))
  );
  const saves: RecentSave[] = recent.map((file) => {
    const note = noteOf(notes.get(file.key) ?? {}, file.id);
    return {
      key: file.key,
      id: file.id,
      title: file.title,
      savedAt: file.savedAt,
      changes: note.changes,
      savedBy: note.by ?? "",
      latest: latestOf.get(file.key) === file.id,
    };
  });
  return Response.json({ saves });
}
