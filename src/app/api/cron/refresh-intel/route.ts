import { scrapeAdLibrary } from "@/lib/intelligence/apify";

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

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.APIFY_TOKEN) {
    return Response.json({ skipped: true, reason: "APIFY_TOKEN not configured" });
  }

  const results = [];
  for (const item of WATCHLIST) {
    try {
      const ads = await scrapeAdLibrary(item.query, item.kind, "US", 5);
      results.push({ ...item, ok: true, adsFound: ads.length });
    } catch (err) {
      results.push({ ...item, ok: false, error: String(err) });
    }
  }

  return Response.json({ ranAt: new Date().toISOString(), results });
}
