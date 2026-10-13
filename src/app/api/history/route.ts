import { describeChanges } from "@/lib/history-changes";
import { historyTitle, projectKey, restoreProposal, type ProjectSummary, type ProjectVersion } from "@/lib/history";
import { USERS, currentUser } from "@/lib/auth";
import { encodeTitle, listVersions, readNotes, readVersion, writeNotes, writeVersion } from "@/lib/history-server";
import type { ProposalData } from "@/lib/proposal";

export const dynamic = "force-dynamic";

/** GET /api/history – saved projects (latest name and save, number of saves), most recently saved first. */
export async function GET() {
  const projects = new Map<string, ProjectSummary>();
  // Oldest first, so each project ends on its latest save.
  for (const file of await listVersions()) {
    const versions = (projects.get(file.key)?.versions ?? 0) + 1;
    projects.set(file.key, { key: file.key, title: file.title, savedAt: file.savedAt, versions });
  }
  const list = [...projects.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return Response.json({ projects: list });
}

/**
 * POST /api/history – body { data }: saves the whole form as a new version of its project (its TTA quote
 * number), noting what changed since the last save. Nothing is saved when nothing changed.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { data?: ProposalData } | null;
  if (!body || typeof body.data !== "object" || body.data === null) {
    return Response.json({ error: "Nothing to save." }, { status: 400 });
  }
  // Fill in any missing fields first, so an incomplete form still gets a name.
  const data = restoreProposal(body.data);
  const key = projectKey(data.quoteNumber);
  if (!key) return Response.json({ error: "Fill in the TTA Quote Number first." }, { status: 400 });

  const latest = (await listVersions(key)).at(-1);
  const previous = latest && (await readVersion(key, latest.id));
  const changes = previous ? describeChanges(restoreProposal(previous as Partial<ProposalData>), data) : ["First save"];
  if (changes.length === 0) {
    return Response.json({ unchanged: true, key });
  }

  const title = historyTitle(data);
  const id = `${Date.now()}_${encodeTitle(title)}`;
  const user = await currentUser();
  const savedBy = user ? USERS[user].name : "";
  await writeVersion(key, id, body.data);
  await writeNotes(key, { ...(await readNotes(key)), [id]: { changes, by: savedBy } });

  const savedAt = new Date(Number(id.split("_")[0])).toISOString();
  const version: ProjectVersion = { id, title, savedAt, changes, savedBy };
  return Response.json({ key, version });
}
