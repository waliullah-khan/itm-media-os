import { fetchRunItems, getRunStatus, startAdLibraryRun } from "@/lib/intelligence/apify";

/**
 * Scheduled ad-library refresh — the native replacement for the n8n
 * schedule-trigger. Wired in vercel.json (weekly); gated behind CRON_SECRET
 * so it can't be triggered by strangers.
 *
 * In production this would re-run the team's saved watchlist queries and
 * persist results (Postgres/Blob). The demo keeps a small watchlist and
 * reports scrape health, demonstrating the scheduling + pipeline plumbing
 * without a database.
 */

export const maxDuration = 300;

const WATCHLIST: { query: string; kind: "keyword" | "page" }[] = [
  { query: "home security", kind: "keyword" },
  { query: "GLP-1 weight loss", kind: "keyword" },
];

async function runToCompletion(
  query: string,
  kind: "keyword" | "page",
  token: string,
): Promise<number> {
  const run = await startAdLibraryRun(query, kind, "US", 5, token);
  const deadline = Date.now() + 240_000;
  for (;;) {
    const status = await getRunStatus(run.runId, token);
    if (status === "succeeded") break;
    if (status === "failed") throw new Error("run failed");
    if (Date.now() > deadline) throw new Error("run timed out");
    await new Promise((r) => setTimeout(r, 10_000));
  }
  const ads = await fetchRunItems(run.datasetId, 5, token);
  return ads.length;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return Response.json({ skipped: true, reason: "APIFY_TOKEN not configured" });
  }

  const results = [];
  for (const item of WATCHLIST) {
    try {
      const adsFound = await runToCompletion(item.query, item.kind, token);
      results.push({ ...item, ok: true, adsFound });
    } catch (err) {
      results.push({ ...item, ok: false, error: String(err) });
    }
  }

  return Response.json({ ranAt: new Date().toISOString(), results });
}
