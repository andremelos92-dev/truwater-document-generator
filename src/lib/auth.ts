import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { get, put } from "@vercel/blob";
import { cookies } from "next/headers";

import { SESSION_COOKIE, signSession, verifySession } from "@/lib/session";

/**
 * Accounts. Each person creates their own password the first time they log in; the master account can
 * clear anyone else's so they set a new one at their next login.
 */
export const USERS = {
  salesandre: { name: "Andre Santos", master: true },
  salescraig: { name: "Craig Alcorn", master: false },
} as const;

export type Username = keyof typeof USERS;

export function findUser(value: unknown): Username | null {
  const name = typeof value === "string" ? value.trim().toLowerCase() : "";
  return name in USERS ? (name as Username) : null;
}

export const MIN_PASSWORD_LENGTH = 8;

export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

type StoredPassword = { salt: string; hash: string; updatedAt: string };
type Store = Partial<Record<Username, StoredPassword>>;

// Production keeps its own list; local and preview runs use a separate one, so testing never touches it.
const STORE_PATH = `auth/users${process.env.VERCEL_ENV === "production" ? "" : `-${process.env.VERCEL_ENV ?? "local"}`}.json`;

async function readStore(): Promise<Store> {
  try {
    const result = await get(STORE_PATH, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return {};
    return JSON.parse(await new Response(result.stream).text()) as Store;
  } catch {
    // Not created yet: nobody has a password.
    return {};
  }
}

async function writeStore(store: Store) {
  await put(STORE_PATH, JSON.stringify(store), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, length: number) => Promise<Buffer>;

export async function hasPassword(username: Username): Promise<boolean> {
  return Boolean((await readStore())[username]);
}

/** Stored scrambled (scrypt with a random salt), so the password itself is never kept. */
export async function setPassword(username: Username, password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  const store = await readStore();
  store[username] = { salt: salt.toString("base64"), hash: hash.toString("base64"), updatedAt: new Date().toISOString() };
  await writeStore(store);
}

export async function checkPassword(username: Username, password: string): Promise<boolean> {
  const stored = (await readStore())[username];
  if (!stored || !password) return false;
  const hash = await scryptAsync(password, Buffer.from(stored.salt, "base64"), 64);
  return timingSafeEqual(hash, Buffer.from(stored.hash, "base64"));
}

/** Clears a password: that person creates a new one at their next login. */
export async function clearPassword(username: Username) {
  const store = await readStore();
  delete store[username];
  await writeStore(store);
}

export async function passwordStatus(): Promise<Record<Username, boolean>> {
  const store = await readStore();
  return Object.fromEntries((Object.keys(USERS) as Username[]).map((u) => [u, Boolean(store[u])])) as Record<Username, boolean>;
}

export async function startSession(username: Username) {
  const { token, expires } = await signSession(username);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expires),
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The signed-in user, or null. */
export async function currentUser(): Promise<Username | null> {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  return session ? findUser(session.username) : null;
}

export const authError = (message: string, status: number) => Response.json({ error: message }, { status });
