// History sits behind the app's login (see src/middleware.ts).

/** Saved projects live under this folder of the blob store, one compressed file per TTA quote number. */
export const PROJECTS_PREFIX = "projects/";

/** Blob pathname for a project. Ids are "<quote key>_<base64url title>", so only safe characters. */
export function projectPath(id: string): string {
  return `${PROJECTS_PREFIX}${id}.json.gz`;
}

/** The id in a project's blob pathname. */
export function projectId(pathname: string): string {
  return pathname.slice(PROJECTS_PREFIX.length).replace(/\.json\.gz$/, "");
}

export function isSafeId(id: string): boolean {
  return /^[A-Z0-9]+_[A-Za-z0-9_-]*$/.test(id);
}

export function encodeTitle(title: string): string {
  return Buffer.from(title, "utf8").toString("base64url");
}

export function decodeTitle(encoded: string): string {
  try {
    return Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return "Untitled";
  }
}
