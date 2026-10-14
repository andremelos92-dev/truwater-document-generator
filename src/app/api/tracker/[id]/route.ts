import { masterUser } from "@/lib/auth";
import { isSafeTrackerId, restoreProject, type TrackedProject } from "@/lib/tracker";
import { deleteTracked, writeTracked } from "@/lib/tracker-server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const notFound = () => Response.json({ error: "Not found." }, { status: 404 });

/** Largest project accepted (notes included). */
const MAX_BYTES = 200_000;

/** PUT /api/tracker/<id> – body: the whole project; stores (or replaces) it. */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  if (!(await masterUser()) || !isSafeTrackerId(id)) return notFound();
  const text = await request.text();
  if (text.length > MAX_BYTES) return Response.json({ error: "This project is too big to save." }, { status: 413 });
  let body: Partial<TrackedProject> | null = null;
  try {
    body = JSON.parse(text);
  } catch {
    // Handled below.
  }
  if (!body || typeof body !== "object" || !body.name?.trim()) {
    return Response.json({ error: "Give the project a name." }, { status: 400 });
  }
  const project = restoreProject({ ...(body as TrackedProject), id, updatedAt: new Date().toISOString() });
  await writeTracked(project);
  return Response.json({ project });
}

/** DELETE /api/tracker/<id> */
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!(await masterUser()) || !isSafeTrackerId(id)) return notFound();
  await deleteTracked(id);
  return Response.json({ ok: true });
}
