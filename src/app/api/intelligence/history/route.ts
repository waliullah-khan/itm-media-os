import { getResearchByRunId, listRecentResearches } from "@/lib/supabase";

/**
 * Research history (Supabase-backed). Without a runId param: the recent-runs
 * list. With one: that run's full research payload.
 */
export async function GET(req: Request) {
  const runId = new URL(req.url).searchParams.get("runId");

  if (runId) {
    if (!/^[\w-]{5,40}$/.test(runId)) {
      return Response.json({ error: "Invalid runId" }, { status: 400 });
    }
    const research = await getResearchByRunId(runId);
    if (!research) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ research });
  }

  return Response.json({ recent: await listRecentResearches(8) });
}
