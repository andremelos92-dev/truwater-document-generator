import { authError, checkPassword, currentUser, passwordProblem, setPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** POST /api/auth/password – body { current, next }: changes the signed-in user's own password. */
export async function POST(request: Request) {
  const username = await currentUser();
  if (!username) return authError("Please log in.", 401);
  const body = (await request.json().catch(() => null)) as { current?: unknown; next?: unknown } | null;
  if (!(await checkPassword(username, typeof body?.current === "string" ? body.current : ""))) {
    return authError("Your current password is wrong.", 400);
  }
  const problem = passwordProblem(body?.next);
  if (problem) return authError(problem, 400);

  await setPassword(username, body!.next as string);
  return Response.json({ ok: true });
}
