import { startAdLibraryRun } from "@/lib/intelligence/apify";
import type { QueryKind } from "@/lib/intelligence/types";
import { getConnections, resolveServiceKeys } from "@/lib/connections/store";
import { clientKey, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

const MAX_ADS = 8;

/**
 * Starts an ad-library research run and returns immediately with a run
 * handle. The client polls /api/intelligence/status — the job runs on
 * Apify's side, so closing or backgrounding the tab can't kill it.
 */
export async function POST(req: Request) {
  const keys = resolveServiceKeys(await getConnections());
  if (!keys.apify || !keys.anthropic) {
    return Response.json(
      {
        error:
          "Live research needs Apify + Anthropic keys. Add yours on the Connections page (stored only in your encrypted cookie), or use the sample researches below.",
      },
      { status: 503 },
    );
  }

  const limit = rateLimit(`intel:${clientKey(req)}`, {
    capacity: 4,
    refillPerMinute: 1,
  });
  if (!limit.ok) {
    return Response.json(
      { error: "Rate limited — live scrapes are capped. Try again in a minute." },
      { status: 429 },
    );
  }

  let query: string, kind: QueryKind, country: string;
  try {
    const body = await req.json();
    query = String(body.query ?? "").trim();
    kind = body.kind === "page" ? "page" : "keyword";
    country = /^[A-Z]{2}$/.test(body.country) ? body.country : "US";
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (query.length < 2 || query.length > 120) {
    return Response.json({ error: "Query must be 2-120 characters" }, { status: 400 });
  }

  try {
    const run = await startAdLibraryRun(query, kind, country, MAX_ADS, keys.apify);
    return Response.json(
      { runId: run.runId, datasetId: run.datasetId, query, kind, country },
      { status: 202 },
    );
  } catch (err) {
    console.error("intelligence run start failed:", err);
    return Response.json(
      { error: "Couldn't start the scrape (Apify). Check the Apify token and try again." },
      { status: 502 },
    );
  }
}
