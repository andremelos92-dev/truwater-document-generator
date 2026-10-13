import { masterUser } from "@/lib/auth";
import { listTables, writeTable } from "@/lib/selector-server";
import { tableId, type MakerTable } from "@/lib/selector";

export const dynamic = "force-dynamic";

// The Tower Selector is for the master account only; anyone else is told it doesn't exist.
const notFound = () => Response.json({ error: "Not found." }, { status: 404 });

/** GET /api/selector – the stored maker tables (without their data). */
export async function GET() {
  if (!(await masterUser())) return notFound();
  return Response.json({ tables: await listTables() });
}

/** POST /api/selector – body { maker, series, fileName, conditions, models }: stores (or replaces) a maker's table. */
export async function POST(request: Request) {
  if (!(await masterUser())) return notFound();
  const body = (await request.json().catch(() => null)) as Partial<MakerTable> | null;
  const maker = body?.maker?.trim();
  const series = body?.series?.trim() ?? "";
  if (!maker || !Array.isArray(body?.conditions) || !Array.isArray(body?.models) || body.models.length === 0) {
    return Response.json({ error: "Give the maker's name and a table with models." }, { status: 400 });
  }
  const table: MakerTable = {
    id: tableId(maker, series),
    maker,
    series,
    fileName: body.fileName?.trim() ?? "",
    addedAt: new Date().toISOString(),
    conditions: body.conditions,
    models: body.models,
  };
  await writeTable(table);
  const { conditions: _conditions, models, ...info } = table;
  return Response.json({ table: { ...info, modelCount: models.length } });
}
