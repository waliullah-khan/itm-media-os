/**
 * Apify Facebook Ads Library scraper client.
 *
 * Uses the same actor the team's old n8n workflow ran
 * (apify/facebook-ads-scraper), called synchronously via
 * run-sync-get-dataset-items so a single request returns dataset rows.
 */

import type { QueryKind, ScrapedAd } from "@/lib/intelligence/types";

const ACTOR = "apify~facebook-ads-scraper";

function buildStartUrl(query: string, kind: QueryKind, country: string): string {
  if (kind === "page") {
    // brand page: accept a full URL or a page handle
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

/* Actor dataset item shape (the fields we read). */
interface ApifySnapshotCard {
  body?: string;
  title?: string;
  cta_type?: string;
  ctaType?: string;
  resized_image_url?: string;
  resizedImageUrl?: string;
  video_sd_url?: string;
  videoSdUrl?: string;
  link_url?: string;
  linkUrl?: string;
}

interface ApifyItem {
  ad_archive_id?: string;
  adArchiveID?: string;
  start_date_formatted?: string;
  startDateFormatted?: string;
  publisher_platform?: string[];
  publisherPlatform?: string[];
  snapshot?: {
    page_name?: string;
    pageName?: string;
    body?: { text?: string } | string;
    title?: string;
    cta_type?: string;
    ctaType?: string;
    cards?: ApifySnapshotCard[];
    images?: { resized_image_url?: string; resizedImageUrl?: string }[];
    videos?: { video_sd_url?: string; videoSdUrl?: string }[];
    link_url?: string;
    linkUrl?: string;
  };
}

function normalizeItem(item: ApifyItem, index: number): ScrapedAd | null {
  const snap = item.snapshot;
  if (!snap) return null;

  const card = snap.cards?.[0];
  const image = snap.images?.[0];
  const video = snap.videos?.[0];

  const bodyText =
    (card?.body ??
      (typeof snap.body === "string" ? snap.body : snap.body?.text)) ||
    null;

  const imageUrl =
    card?.resized_image_url ??
    card?.resizedImageUrl ??
    image?.resized_image_url ??
    image?.resizedImageUrl ??
    null;
  const videoUrl =
    card?.video_sd_url ?? card?.videoSdUrl ?? video?.video_sd_url ?? video?.videoSdUrl ?? null;

  return {
    id: item.ad_archive_id ?? item.adArchiveID ?? `ad-${index}`,
    pageName: snap.page_name ?? snap.pageName ?? "Unknown page",
    body: bodyText,
    ctaType: card?.cta_type ?? card?.ctaType ?? snap.cta_type ?? snap.ctaType ?? null,
    title: card?.title ?? snap.title ?? null,
    mediaUrl: imageUrl ?? videoUrl,
    mediaKind: imageUrl ? "image" : videoUrl ? "video" : null,
    landingUrl: card?.link_url ?? card?.linkUrl ?? snap.link_url ?? snap.linkUrl ?? null,
    startedRunning: item.start_date_formatted ?? item.startDateFormatted ?? null,
    platforms: item.publisher_platform ?? item.publisherPlatform ?? [],
  };
}

export interface StartedRun {
  runId: string;
  datasetId: string;
}

/**
 * Kick off an ad-library scrape asynchronously and return immediately.
 * The client polls run status — a browser tab switch, reload, or slow actor
 * can't kill the job (the old run-sync approach died with the connection).
 */
export async function startAdLibraryRun(
  query: string,
  kind: QueryKind,
  country: string,
  limit: number,
  token: string,
): Promise<StartedRun> {
  const input = {
    startUrls: [{ url: buildStartUrl(query, kind, country) }],
    resultsLimit: limit,
    activeStatus: "active",
    isDetailsPerAd: true,
    onlyTotal: false,
    includeAboutPage: false,
  };

  const res = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs?token=${token}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`Apify run start failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    data: { id: string; defaultDatasetId: string };
  };
  return { runId: json.data.id, datasetId: json.data.defaultDatasetId };
}

export type RunStatus = "running" | "succeeded" | "failed";

export async function getRunStatus(runId: string, token: string): Promise<RunStatus> {
  const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Apify status check failed: ${res.status}`);
  const json = (await res.json()) as { data: { status: string } };
  const s = json.data.status;
  if (s === "SUCCEEDED") return "succeeded";
  if (["FAILED", "ABORTED", "TIMED-OUT"].includes(s)) return "failed";
  return "running";
}

export async function fetchRunItems(
  datasetId: string,
  limit: number,
  token: string,
): Promise<ScrapedAd[]> {
  const res = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true`,
    { signal: AbortSignal.timeout(60_000) },
  );
  if (!res.ok) throw new Error(`Apify dataset fetch failed: ${res.status}`);

  const items = (await res.json()) as ApifyItem[];
  const ads = items
    .map(normalizeItem)
    .filter((a): a is ScrapedAd => a !== null && (a.body !== null || a.mediaUrl !== null));

  // de-dupe near-identical bodies (the library returns many variants)
  const seen = new Set<string>();
  return ads
    .filter((a) => {
      const key = (a.body ?? a.id).slice(0, 120);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
