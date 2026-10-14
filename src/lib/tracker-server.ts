import { del, get, list, put } from "@vercel/blob";

import { restoreProject, type TrackedProject } from "@/lib/tracker";

// Master account only (checked by the API routes). Kept apart from the document History ("projects/").

/** One file per tracked project: tracker/<id>.json */
const PREFIX = "tracker/";
const path = (id: string) => `${PREFIX}${id}.json`;

export async function listTracked(): Promise<TrackedProject[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: PREFIX, cursor });
    for (const blob of page.blobs) ids.push(blob.pathname.slice(PREFIX.length).replace(/\.json$/, ""));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  const projects = await Promise.all(ids.map(readTracked));
  return projects.filter((p): p is TrackedProject => p !== null);
}

export async function readTracked(id: string): Promise<TrackedProject | null> {
  const result = await get(path(id), { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) return null;
  return restoreProject(JSON.parse(await new Response(result.stream).text()) as TrackedProject);
}

export async function writeTracked(project: TrackedProject) {
  await put(path(project.id), JSON.stringify(project), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
  });
}

export async function deleteTracked(id: string) {
  await del(path(id));
}
