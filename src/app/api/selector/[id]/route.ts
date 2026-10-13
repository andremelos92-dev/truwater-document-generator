import { masterUser } from "@/lib/auth";
import { deleteTable, isSafeTableId, readTable } from "@/lib/selector-server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const notFound = () => Response.json({ error: "Not found." }, { status: 404 });

/** GET /api/selector/<id> – a maker's whole table. */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!(await masterUser()) || !isSafeTableId(id)) return notFound();
  const table = await readTable(id);
  return table ? Response.json({ table }) : notFound();
}

/** DELETE /api/selector/<id> */
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!(await masterUser()) || !isSafeTableId(id)) return notFound();
  await deleteTable(id);
  return Response.json({ ok: true });
}
