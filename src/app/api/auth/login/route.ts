import { authError, checkPassword, findUser, hasPassword, startSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const WRONG = "Wrong username or password.";

/**
 * POST /api/auth/login – body { username, password }. An account with no password yet answers
 * { needsPassword: true } so the login page can ask for one.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
  const username = findUser(body?.username);
  if (!username) return authError(WRONG, 401);
  if (!(await hasPassword(username))) return Response.json({ needsPassword: true });

  const password = typeof body?.password === "string" ? body.password : "";
  if (!(await checkPassword(username, password))) {
    // A short pause makes guessing passwords slow.
    await new Promise((resolve) => setTimeout(resolve, 800));
    return authError(WRONG, 401);
  }
  await startSession(username);
  return Response.json({ ok: true });
}
