// History has no password of its own; it will sit behind the app's login once that exists.

/** Blob pathname for an entry. Ids are "<timestamp>_<base64url title>", so only safe characters. */
export function entryPath(kind: string, id: string): string {
  return `history/${kind}/${id}.json`;
}

export function isSafeId(id: string): boolean {
  return /^\d+_[A-Za-z0-9_-]*$/.test(id);
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
