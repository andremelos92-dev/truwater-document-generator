import { gunzipSync } from "node:zlib";
import { del, get } from "@vercel/blob";

import { isSafeId, projectPath } from "@/lib/history-server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function badRequest() {
  return Response.json({ error: "Unknown project." }, { status: 400 });
}

/** GET /api/history/<id> – the saved form data, uncompressed. */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!isSafeId(id)) return badRequest();

  const result = await get(projectPath(id), { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) return Response.json({ error: "Not found." }, { status: 404 });
  const compressed = Buffer.from(await new Response(result.stream).arrayBuffer());
  return new Response(gunzipSync(compressed), { headers: { "content-type": "application/json" } });
}

/** DELETE /api/history/<id> */
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!isSafeId(id)) return badRequest();

  await del(projectPath(id));
  return Response.json({ ok: true });
}
