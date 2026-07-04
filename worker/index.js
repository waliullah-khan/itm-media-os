/**
 * Media Buying OS — Watchlist Worker (Railway)
 * =============================================
 *
 * A long-running Node process, separate from the Vercel app, that refreshes a
 * competitor-ad watchlist on an interval. This is the piece Vercel's
 * serverless model can't do well: a durable loop that fans out multi-minute
 * Apify scrapes, analyzes each with Claude, and persists the result — with no
 * request holding it open and no 300-second function ceiling.
 *
 * Architecture role:
 *   Vercel serves the app · Apify runs the scrapes · THIS WORKER schedules and
 *   ingests them · Supabase stores the results (read back by the app's
 *   Ad Intelligence page under "Recent").
 *
 * Env:
 *   APIFY_TOKEN, ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY   (required)
 *   WATCHLIST                  JSON array of {query,kind,country}      (optional)
 *   REFRESH_INTERVAL_MINUTES   default 360 (6h)                        (optional)
 *   ADS_PER_QUERY              default 5                               (optional)
 *   ANALYST_MODEL              default claude-sonnet-5                 (optional)
 */

import Anthropic from "@anthropic-ai/sdk";

const {
  APIFY_TOKEN,
  ANTHROPIC_API_KEY,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  ANALYST_MODEL = "claude-sonnet-5",
} = process.env;

const INTERVAL_MS = Number(process.env.REFRESH_INTERVAL_MINUTES ?? 360) * 60_000;
const ADS_PER_QUERY = Number(process.env.ADS_PER_QUERY ?? 5);
const ACTOR = "apify~facebook-ads-scraper";

const DEFAULT_WATCHLIST = [
  { query: "home security", kind: "keyword", country: "US" },
  { query: "GLP-1 weight loss", kind: "keyword", country: "US" },
  { query: "debt relief", kind: "keyword", country: "US" },
  { query: "solar panels", kind: "keyword", country: "US" },
];

function watchlist() {
  if (!process.env.WATCHLIST) return DEFAULT_WATCHLIST;
  try {
    const parsed = JSON.parse(process.env.WATCHLIST);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_WATCHLIST;
  } catch {
    log("WATCHLIST env is not valid JSON — using defaults");
    return DEFAULT_WATCHLIST;
  }
}

function log(...args) {
  console.log(new Date().toISOString(), "|", ...args);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Apify — start / poll / fetch (mirrors the app's async pipeline)
// ---------------------------------------------------------------------------

function buildStartUrl(query, kind, country) {
  if (kind === "page") {
    return query.startsWith("http")
      ? query
      : `https://www.facebook.com/${query.replace(/^@/, "")}`;
  }
  const params = new URLSearchParams({
    active_status: "active",
    ad_type: "all",
    country,
    q: query,
    search_type: "keyword_unordered",
    media_type: "all",
  });
  return `https://www.facebook.com/ads/library/?${params}`;
}

async function startRun(query, kind, country, limit) {
  const res = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs?token=${APIFY_TOKEN}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      startUrls: [{ url: buildStartUrl(query, kind, country) }],
      resultsLimit: limit,
      activeStatus: "active",
      isDetailsPerAd: true,
      onlyTotal: false,
      includeAboutPage: false,
    }),
  });
  if (!res.ok) throw new Error(`Apify start failed ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return { runId: json.data.id, datasetId: json.data.defaultDatasetId };
}

async function runStatus(runId) {
  const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
  if (!res.ok) throw new Error(`Apify status failed ${res.status}`);
  const s = (await res.json()).data.status;
  if (s === "SUCCEEDED") return "succeeded";
  if (["FAILED", "ABORTED", "TIMED-OUT"].includes(s)) return "failed";
  return "running";
}

function normalizeItem(item, i) {
  const snap = item.snapshot;
  if (!snap) return null;
  const card = snap.cards?.[0];
  const image = snap.images?.[0];
  const video = snap.videos?.[0];
  const body =
    card?.body ?? (typeof snap.body === "string" ? snap.body : snap.body?.text) ?? null;
  const imageUrl = card?.resized_image_url ?? image?.resized_image_url ?? null;
  const videoUrl = card?.video_sd_url ?? video?.video_sd_url ?? null;
  return {
    id: item.ad_archive_id ?? `ad-${i}`,
    pageName: snap.page_name ?? "Unknown page",
    body,
    ctaType: card?.cta_type ?? snap.cta_type ?? null,
    title: card?.title ?? snap.title ?? null,
    mediaUrl: imageUrl ?? videoUrl,
    mediaKind: imageUrl ? "image" : videoUrl ? "video" : null,
    landingUrl: card?.link_url ?? snap.link_url ?? null,
    startedRunning: item.start_date_formatted ?? null,
    platforms: item.publisher_platform ?? [],
  };
}

async function fetchItems(datasetId, limit) {
  const res = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true`,
  );
  if (!res.ok) throw new Error(`Apify dataset fetch failed ${res.status}`);
  const items = await res.json();
  const ads = items
    .map(normalizeItem)
    .filter((a) => a && (a.body || a.mediaUrl));
  const seen = new Set();
  return ads
    .filter((a) => {
      const key = (a.body ?? a.id).slice(0, 120);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

async function scrapeToCompletion(query, kind, country, limit) {
  const { runId, datasetId } = await startRun(query, kind, country, limit);
  const deadline = Date.now() + 240_000;
  for (;;) {
    const status = await runStatus(runId);
    if (status === "succeeded") break;
    if (status === "failed") throw new Error("run failed");
    if (Date.now() > deadline) throw new Error("run timed out");
    await sleep(10_000);
  }
  return { runId, ads: await fetchItems(datasetId, limit) };
}

// ---------------------------------------------------------------------------
// Claude analysis (same shape the app produces)
// ---------------------------------------------------------------------------

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const ANALYSIS_SCHEMA = {
  name: "competitor_ad_analysis",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      ads: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            adId: { type: "string" },
            hook: { type: "string" },
            angle: { type: "string" },
            format: { type: "string" },
            emotion: { type: "string" },
            whyItWorks: { type: "string" },
            reproductionPrompt: { type: "string" },
          },
          required: ["adId", "hook", "angle", "format", "emotion", "whyItWorks", "reproductionPrompt"],
        },
      },
      patterns: { type: "array", items: { type: "string" } },
      recommendations: { type: "array", items: { type: "string" } },
    },
    required: ["ads", "patterns", "recommendations"],
  },
};

async function analyze(query, ads) {
  const adDescriptions = ads
    .map(
      (ad) => `<ad id="${ad.id}">
page: ${ad.pageName}
running since: ${ad.startedRunning ?? "unknown"}
format: ${ad.mediaKind ?? "text"}
headline: ${ad.title ?? "—"}
cta: ${ad.ctaType ?? "—"}
body: ${ad.body?.slice(0, 900) ?? "—"}
</ad>`,
    )
    .join("\n\n");

  const res = await anthropic.messages.create({
    model: ANALYST_MODEL,
    max_tokens: 8000,
    // Structured outputs (json_schema) — the response is guaranteed to match
    // the schema, which is more reliable than a forced tool call for a payload
    // this large (a truncated tool call was serializing `ads` as a string).
    output_config: {
      format: { type: "json_schema", schema: ANALYSIS_SCHEMA },
    },
    system:
      "You are a direct-response creative strategist at an affiliate marketing company. You reverse-engineer competitor ads: the hook, the persuasion angle, and how to reproduce the mechanics (never the brand assets) for our own offers. An ad running for months is proven. Reproduction prompts get handed straight to the creative team, so be specific and practical. Keep each reproduction prompt to about 4 concise sentences so the full JSON fits.",
    messages: [
      {
        role: "user",
        content: `Research query: "${query}". Analyze each competitor ad and extract account-level patterns. Return JSON matching the schema.\n\n${adDescriptions}`,
      },
    ],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("no analysis returned");

  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error("analysis was not valid JSON");
  }

  // Defensive coercion — never let a malformed shape reach the DB / frontend.
  const analyzedAds = Array.isArray(parsed.ads)
    ? parsed.ads
    : typeof parsed.ads === "string"
      ? JSON.parse(parsed.ads)
      : [];
  return {
    ads: analyzedAds,
    patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
  };
}

// ---------------------------------------------------------------------------
// Supabase persistence
// ---------------------------------------------------------------------------

async function saveResearch(runId, research) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/research_runs`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "content-type": "application/json",
      prefer: "resolution=ignore-duplicates",
    },
    body: JSON.stringify({
      run_id: runId,
      query: research.query,
      kind: research.kind,
      country: research.country,
      source: "watchlist",
      ads_count: research.ads.length,
      payload: research,
    }),
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`Supabase insert failed ${res.status}: ${await res.text()}`);
  }
}

// ---------------------------------------------------------------------------
// Cycle
// ---------------------------------------------------------------------------

async function processOne(item) {
  const { query, kind = "keyword", country = "US" } = item;
  log(`▶ scraping "${query}" (${country})`);
  const { runId, ads } = await scrapeToCompletion(query, kind, country, ADS_PER_QUERY);
  if (ads.length === 0) {
    log(`· no active ads for "${query}"`);
    return;
  }
  log(`· ${ads.length} ads scraped, analyzing…`);
  const analysis = await analyze(query, ads);
  if (!Array.isArray(analysis.ads) || analysis.ads.length === 0) {
    throw new Error("analysis produced no ad breakdowns — not saving");
  }
  const research = {
    query,
    kind,
    country,
    fetchedAt: new Date().toISOString(),
    source: "watchlist",
    ads,
    analyses: analysis.ads,
    patterns: analysis.patterns,
    recommendations: analysis.recommendations,
    landingPageNotes: null,
  };
  await saveResearch(runId, research);
  log(`✓ saved "${query}" (run ${runId})`);
}

async function cycle() {
  const list = watchlist();
  log(`=== watchlist cycle: ${list.length} queries ===`);
  for (const item of list) {
    try {
      await processOne(item);
    } catch (err) {
      log(`✗ "${item.query}" failed:`, err.message ?? err);
    }
  }
  log(`=== cycle complete; next in ${INTERVAL_MS / 60_000} min ===`);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function requireEnv() {
  const missing = ["APIFY_TOKEN", "ANTHROPIC_API_KEY", "SUPABASE_URL", "SUPABASE_ANON_KEY"].filter(
    (k) => !process.env[k],
  );
  if (missing.length) {
    log("FATAL: missing env:", missing.join(", "));
    process.exit(1);
  }
}

async function main() {
  requireEnv();
  log("watchlist worker starting", `(interval ${INTERVAL_MS / 60_000} min, ${ADS_PER_QUERY} ads/query)`);
  await cycle();
  setInterval(() => {
    cycle().catch((err) => log("cycle error:", err.message ?? err));
  }, INTERVAL_MS);
}

main().catch((err) => {
  log("fatal:", err);
  process.exit(1);
});
