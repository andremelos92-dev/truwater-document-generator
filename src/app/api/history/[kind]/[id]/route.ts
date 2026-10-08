import { del, get } from "@vercel/blob";

import { isHistoryKind } from "@/lib/history";
import { entryPath, isSafeId } from "@/lib/history-server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ kind: string; id: string }> };

function badRequest() {
  return Response.json({ error: "Unknown entry." }, { status: 400 });
}

/** GET /api/history/<kind>/<id> – the saved form data. */
export async function GET(_request: Request, { params }: Params) {
  const { kind, id } = await params;
  if (!isHistoryKind(kind) || !isSafeId(id)) return badRequest();

  const result = await get(entryPath(kind, id), { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) return Response.json({ error: "Not found." }, { status: 404 });
  const text = await new Response(result.stream).text();
  return new Response(text, { headers: { "content-type": "application/json" } });
}

/** DELETE /api/history/<kind>/<id> */
export async function DELETE(_request: Request, { params }: Params) {
  const { kind, id } = await params;
  if (!isHistoryKind(kind) || !isSafeId(id)) return badRequest();

  await del(entryPath(kind, id));
  return Response.json({ ok: true });
}
