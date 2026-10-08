import { USERS, authError, currentUser, passwordStatus, type Username } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/auth/me – the signed-in user; the master account also gets every account's status. */
export async function GET() {
  const username = await currentUser();
  if (!username) return authError("Please log in.", 401);
  const { name, master } = USERS[username];
  const status = master ? await passwordStatus() : null;
  return Response.json({
    username,
    name,
    master,
    users: status
      ? (Object.keys(USERS) as Username[]).map((u) => ({ username: u, name: USERS[u].name, hasPassword: status[u] }))
      : undefined,
  });
}
