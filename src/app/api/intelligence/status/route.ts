import { fetchRunItems, getRunStatus } from "@/lib/intelligence/apify";
import { scrapeLandingPage } from "@/lib/intelligence/firecrawl";
import { analyzeAds } from "@/lib/intelligence/analyze";
import type { QueryKind, Research } from "@/lib/intelligence/types";
import { resolveServiceKeys } from "@/lib/connections/store";
import { getEffectiveConnections } from "@/lib/connections/mode";
import { getResearchByRunId, saveResearch } from "@/lib/supabase";

/** Analysis of a finished scrape can take ~1 min of Claude time. */
export const maxDuration = 300;

/** One research per finished run — repeat polls after success are free. */
const completed = new Map<string, Research>();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const runId = url.searchParams.get("runId") ?? "";
  const datasetId = url.searchParams.get("datasetId") ?? "";
  const query = url.searchParams.get("query") ?? "";
  const kind: QueryKind = url.searchParams.get("kind") === "page" ? "page" : "keyword";
  const country = url.searchParams.get("country") ?? "US";

  if (!/^[\w-]{5,40}$/.test(runId) || !/^[\w-]{5,40}$/.test(datasetId)) {
    return Response.json({ error: "Invalid run handle" }, { status: 400 });
  }

  // finished already? — check this instance's memory, then Supabase (another
  // serverless instance may have completed the analysis)
  const done = completed.get(runId) ?? (await getResearchByRunId(runId));
  if (done) return Response.json({ status: "done", research: done });

  const eff = await getEffectiveConnections();
  // Live board: only the visitor's own keys — never the deployment's.
  const keys = resolveServiceKeys(eff.connections, {
    allowEnvFallback: eff.mode !== "live",
  });
  if (!keys.apify || !keys.anthropic) {
    return Response.json({ error: "Keys no longer available" }, { status: 503 });
  }

  try {
    const status = await getRunStatus(runId, keys.apify);
    if (status === "running") {
      return Response.json({ status: "running" });
    }
    if (status === "failed") {
      return Response.json(
        { status: "failed", error: "The Apify scrape failed — try a broader keyword." },
        { status: 502 },
      );
    }

    const ads = await fetchRunItems(datasetId, 8, keys.apify);
    if (ads.length === 0) {
      return Response.json(
        {
          status: "failed",
          error: `No active ads found for "${query}". Try a broader keyword or a brand page.`,
        },
        { status: 404 },
      );
    }

    const landingUrl = ads.find((a) => a.landingUrl)?.landingUrl ?? null;
    const landingMarkdown =
      landingUrl && keys.firecrawl ? await scrapeLandingPage(landingUrl, keys.firecrawl) : null;

    const analysis = await analyzeAds(query, ads, landingMarkdown, keys.anthropic);

    const research: Research = {
      query,
      kind,
      country,
      fetchedAt: new Date().toISOString(),
      source: "live",
      ads,
      analyses: analysis.analyses,
      patterns: analysis.patterns,
      recommendations: analysis.recommendations,
      landingPageNotes: analysis.landingPageNotes,
    };
    completed.set(runId, research);
    await saveResearch(runId, research);
    return Response.json({ status: "done", research });
  } catch (err) {
    console.error("intelligence status/analysis failed:", err);
    return Response.json(
      { status: "failed", error: "Analysis failed after the scrape — poll again to retry." },
      { status: 502 },
    );
  }
}
