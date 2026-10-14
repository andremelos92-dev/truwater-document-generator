import { masterUser } from "@/lib/auth";
import { listTracked } from "@/lib/tracker-server";

export const dynamic = "force-dynamic";

// The project tracker is for the master account only; anyone else is told it doesn't exist.
const notFound = () => Response.json({ error: "Not found." }, { status: 404 });

/** GET /api/tracker – every tracked project. */
export async function GET() {
  if (!(await masterUser())) return notFound();
  return Response.json({ projects: await listTracked() });
}
