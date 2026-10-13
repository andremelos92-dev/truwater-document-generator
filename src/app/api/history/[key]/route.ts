import type { ProjectVersion } from "@/lib/history";
import { deleteProject, isSafeKey, listVersions, noteOf, readNotes } from "@/lib/history-server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ key: string }> };

const badRequest = () => Response.json({ error: "Unknown project." }, { status: 400 });

/** GET /api/history/<key> – every save of the project, newest first, with what changed in each. */
export async function GET(_request: Request, { params }: Params) {
  const { key } = await params;
  if (!isSafeKey(key)) return badRequest();

  const [files, notes] = await Promise.all([listVersions(key), readNotes(key)]);
  const versions: ProjectVersion[] = files
    .map((file) => {
      const note = noteOf(notes, file.id);
      return { id: file.id, title: file.title, savedAt: file.savedAt, changes: note.changes, savedBy: note.by ?? "" };
    })
    .reverse();
  return Response.json({ versions });
}

/** DELETE /api/history/<key> – the whole project, every save. */
export async function DELETE(_request: Request, { params }: Params) {
  const { key } = await params;
  if (!isSafeKey(key)) return badRequest();

  await deleteProject(key);
  return Response.json({ ok: true });
}
