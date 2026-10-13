import { gunzipSync, gzipSync } from "node:zlib";
import { del, get, list, put } from "@vercel/blob";

import type { MakerTable, MakerTableInfo } from "@/lib/selector";

// Master account only (checked by the API routes).

/** One compressed file per maker table: selector/tables/<id>.json.gz */
const PREFIX = "selector/tables/";
const path = (id: string) => `${PREFIX}${id}.json.gz`;

export const isSafeTableId = (id: string) => /^[a-z0-9-]{1,80}$/.test(id);

export async function listTables(): Promise<MakerTableInfo[]> {
  const infos: MakerTableInfo[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: PREFIX, cursor });
    for (const blob of page.blobs) {
      const table = await readTable(blob.pathname.slice(PREFIX.length).replace(/\.json\.gz$/, ""));
      if (table) {
        const { conditions: _conditions, models, ...info } = table;
        infos.push({ ...info, modelCount: models.length });
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return infos.sort((a, b) => a.maker.localeCompare(b.maker) || a.series.localeCompare(b.series));
}

export async function readTable(id: string): Promise<MakerTable | null> {
  const result = await get(path(id), { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) return null;
  const file = Buffer.from(await new Response(result.stream).arrayBuffer());
  return JSON.parse(gunzipSync(file).toString("utf8")) as MakerTable;
}

export async function writeTable(table: MakerTable) {
  await put(path(table.id), gzipSync(JSON.stringify(table)), {
    access: "private",
    contentType: "application/gzip",
    allowOverwrite: true,
  });
}

export async function deleteTable(id: string) {
  await del(path(id));
}
