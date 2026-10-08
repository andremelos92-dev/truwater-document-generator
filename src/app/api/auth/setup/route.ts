import { authError, findUser, hasPassword, passwordProblem, setPassword, startSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** POST /api/auth/setup – body { username, password }: first login only, creates the account's password. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
  const username = findUser(body?.username);
  if (!username) return authError("Unknown username.", 400);
  if (await hasPassword(username)) return authError("This account already has a password. Log in instead.", 409);
  const problem = passwordProblem(body?.password);
  if (problem) return authError(problem, 400);

  await setPassword(username, body!.password as string);
  await startSession(username);
  return Response.json({ ok: true });
}
