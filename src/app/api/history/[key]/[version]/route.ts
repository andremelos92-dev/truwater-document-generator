import { deleteVersion, isSafeKey, isSafeVersion, listVersions, readVersion } from "@/lib/history-server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ key: string; version: string }> };

const badRequest = () => Response.json({ error: "Unknown project or version." }, { status: 400 });
const notFound = () => Response.json({ error: "That project or version isn't saved." }, { status: 404 });

/** GET /api/history/<key>/<version> – a save's form data; "latest" is the project's newest save. */
export async function GET(_request: Request, { params }: Params) {
  const { key, version } = await params;
  if (!isSafeKey(key) || (version !== "latest" && !isSafeVersion(version))) return badRequest();

  const id = version === "latest" ? (await listVersions(key)).at(-1)?.id : version;
  const data = id && (await readVersion(key, id));
  return data ? Response.json({ id, data }) : notFound();
}

/** DELETE /api/history/<key>/<version> – one save. */
export async function DELETE(_request: Request, { params }: Params) {
  const { key, version } = await params;
  if (!isSafeKey(key) || !isSafeVersion(version)) return badRequest();

  await deleteVersion(key, version);
  return Response.json({ ok: true });
}
