import { scrapeAdLibrary } from "@/lib/intelligence/apify";
import { scrapeLandingPage } from "@/lib/intelligence/firecrawl";
import { analyzeAds } from "@/lib/intelligence/analyze";
import type { QueryKind, Research } from "@/lib/intelligence/types";
import { clientKey, rateLimit } from "@/lib/ratelimit";

/** Ad-library scrapes can take minutes — needs fluid compute headroom. */
export const maxDuration = 300;

const MAX_ADS = 8;

export async function POST(req: Request) {
  if (!process.env.APIFY_TOKEN || !process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      {
        error:
          "Live research needs APIFY_TOKEN and ANTHROPIC_API_KEY configured. The sample researches on this page show exactly what a live run produces.",
      },
      { status: 503 },
    );
  }

  const limit = rateLimit(`intel:${clientKey(req)}`, {
    capacity: 3,
    refillPerMinute: 0.5,
  });
  if (!limit.ok) {
    return Response.json(
      { error: "Rate limited — live scrapes are capped on the open demo. Try again in a couple of minutes." },
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
    const ads = await scrapeAdLibrary(query, kind, country, MAX_ADS);
    if (ads.length === 0) {
      return Response.json(
        { error: `No active ads found for "${query}" in ${country}. Try a broader keyword or a brand page.` },
        { status: 404 },
      );
    }

    const landingUrl = ads.find((a) => a.landingUrl)?.landingUrl ?? null;
    const landingMarkdown = landingUrl ? await scrapeLandingPage(landingUrl) : null;

    const analysis = await analyzeAds(query, ads, landingMarkdown);

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

    return Response.json(research);
  } catch (err) {
    console.error("intelligence pipeline failed:", err);
    return Response.json(
      { error: "The live pipeline hit an error (scraper or analysis). Try again, or use the sample researches." },
      { status: 502 },
    );
  }
}
