import { gunzipSync, gzipSync } from "node:zlib";
import { del, get, list, put } from "@vercel/blob";

// History sits behind the app's login (see src/middleware.ts).

/**
 * Saved projects live under this folder of the blob store, one folder per TTA quote number:
 *   projects/<KEY>/<timestamp>_<base64url title>.json.gz   one compressed file per save (the whole form)
 *   projects/<KEY>/notes.json                              what changed in each save, by version id
 */
export const PROJECTS_PREFIX = "projects/";

export type VersionFile = { key: string; id: string; title: string; savedAt: string; pathname: string };

/** Change notes of a project's saves, by version id. */
export type Notes = Record<string, string[]>;

export const isSafeKey = (key: string) => /^[A-Z0-9]+$/.test(key);
export const isSafeVersion = (id: string) => /^\d+_[A-Za-z0-9_-]*$/.test(id);

export const projectFolder = (key: string) => `${PROJECTS_PREFIX}${key}/`;
export const versionPath = (key: string, id: string) => `${projectFolder(key)}${id}.json.gz`;
const notesPath = (key: string) => `${projectFolder(key)}notes.json`;

export const encodeTitle = (title: string) => Buffer.from(title, "utf8").toString("base64url");

function decodeTitle(encoded: string): string {
  try {
    return Buffer.from(encoded, "base64url").toString("utf8") || "Untitled";
  } catch {
    return "Untitled";
  }
}

/** A save's file, or null for anything else in the folder (like notes.json). */
function parseVersion(pathname: string): VersionFile | null {
  const match = /^projects\/([A-Z0-9]+)\/((\d+)_([A-Za-z0-9_-]*))\.json\.gz$/.exec(pathname);
  if (!match) return null;
  const [, key, id, time, title] = match;
  return { key, id, title: decodeTitle(title), savedAt: new Date(Number(time)).toISOString(), pathname };
}

async function listAll(prefix: string) {
  const blobs: { pathname: string; uploadedAt: Date }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

async function read(pathname: string): Promise<Buffer | null> {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) return null;
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}

/** A save's form data (as saved), or null when it isn't there. */
export async function readVersion(key: string, id: string): Promise<unknown | null> {
  const file = await read(versionPath(key, id));
  return file && JSON.parse(gunzipSync(file).toString("utf8"));
}

export async function writeVersion(key: string, id: string, data: unknown) {
  await put(versionPath(key, id), gzipSync(JSON.stringify(data)), {
    access: "private",
    contentType: "application/gzip",
    allowOverwrite: true,
  });
}

export async function readNotes(key: string): Promise<Notes> {
  const file = await read(notesPath(key));
  try {
    return file ? (JSON.parse(file.toString("utf8")) as Notes) : {};
  } catch {
    return {};
  }
}

export async function writeNotes(key: string, notes: Notes) {
  await put(notesPath(key), JSON.stringify(notes), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
  });
}

/**
 * Saves from before versions were kept ("projects/<KEY>_<title>.json.gz", one per project) become each
 * project's first version.
 */
async function moveOldSaves(blobs: { pathname: string; uploadedAt: Date }[]): Promise<boolean> {
  let moved = false;
  for (const blob of blobs) {
    const match = /^projects\/([A-Z0-9]+)_([A-Za-z0-9_-]*)\.json\.gz$/.exec(blob.pathname);
    if (!match) continue;
    const [, key, title] = match;
    const file = await read(blob.pathname);
    if (file) {
      const id = `${new Date(blob.uploadedAt).getTime()}_${title}`;
      await put(versionPath(key, id), file, { access: "private", contentType: "application/gzip", allowOverwrite: true });
      await writeNotes(key, { ...(await readNotes(key)), [id]: ["First save"] });
    }
    await del(blob.pathname);
    moved = true;
  }
  return moved;
}

/** Every save in the store (or in one project's folder), oldest first. */
export async function listVersions(key?: string): Promise<VersionFile[]> {
  if (key) await moveOldSaves(await listAll(`${PROJECTS_PREFIX}${key}_`));
  let blobs = await listAll(key ? projectFolder(key) : PROJECTS_PREFIX);
  if (!key && (await moveOldSaves(blobs))) blobs = await listAll(PROJECTS_PREFIX);
  return blobs
    .map((blob) => parseVersion(blob.pathname))
    .filter((file): file is VersionFile => file !== null)
    .sort((a, b) => a.savedAt.localeCompare(b.savedAt) || a.id.localeCompare(b.id));
}

/** Deletes a project's whole folder (every save and its notes). */
export async function deleteProject(key: string) {
  const blobs = await listAll(projectFolder(key));
  if (blobs.length) await del(blobs.map((blob) => blob.pathname));
}

/** Deletes one save and its change notes. */
export async function deleteVersion(key: string, id: string) {
  await del(versionPath(key, id));
  const notes = await readNotes(key);
  if (id in notes) {
    delete notes[id];
    await writeNotes(key, notes);
  }
}
