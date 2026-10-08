import { USERS, authError, clearPassword, currentUser, findUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/reset – body { username }: master account only. Clears that person's password so they
 * create a new one at their next login.
 */
export async function POST(request: Request) {
  const me = await currentUser();
  if (!me) return authError("Please log in.", 401);
  if (!USERS[me].master) return authError("Only the master account can reset passwords.", 403);
  const body = (await request.json().catch(() => null)) as { username?: unknown } | null;
  const target = findUser(body?.username);
  if (!target) return authError("Unknown username.", 400);
  if (target === me) return authError("Change your own password with the form above instead.", 400);

  await clearPassword(target);
  return Response.json({ ok: true });
}
