/**
 * Signed-in sessions: a cookie holding the username and an expiry, signed so it can't be forged. Uses Web
 * Crypto only, so the same code checks it in middleware (which guards every page) and in the API routes.
 */

export const SESSION_COOKIE = "truwater_session";
export const SESSION_DAYS = 30;

export type Session = { username: string; expires: number };

const encoder = new TextEncoder();

/** The signing key, derived from AUTH_SECRET if set, else from the Blob token (a server-only secret). */
async function signingKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET || process.env.BLOB_READ_WRITE_TOKEN;
  if (!secret) throw new Error("No secret to sign sessions with (set AUTH_SECRET).");
  const raw = await crypto.subtle.digest("SHA-256", encoder.encode(`truwater-session:${secret}`));
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

const toBase64Url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const fromBase64Url = (value: string) =>
  Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

export async function signSession(username: string): Promise<{ token: string; expires: number }> {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = toBase64Url(encoder.encode(JSON.stringify({ u: username, e: expires })));
  const signature = await crypto.subtle.sign("HMAC", await signingKey(), encoder.encode(payload));
  return { token: `${payload}.${toBase64Url(signature)}`, expires };
}

/** The session in a cookie value, or null if it's missing, tampered with or expired. */
export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  try {
    const valid = await crypto.subtle.verify("HMAC", await signingKey(), fromBase64Url(signature), encoder.encode(payload));
    if (!valid) return null;
    const { u, e } = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    if (typeof u !== "string" || typeof e !== "number" || e < Date.now()) return null;
    return { username: u, expires: e };
  } catch {
    return null;
  }
}
