/**
 * LIVE TikTok adapter — TikTok for Business Marketing API v1.3.
 * Token auth (Access-Token header) + advertiser ID; validated at connect
 * time via advertiser/info. Daily reporting is chunked into ≤30-day windows
 * (the integrated report's limit for stat_time_day).
 *
 * revenue: TikTok only reports payment value for shop/pixel-value events —
 * accounts without value tracking report $0 revenue.
 */

import type {
  Ad,
  Campaign,
  DailyMetric,
  DateRange,
  PlatformAdapter,
} from "@/lib/adapters/types";
import type { TikTokConnection } from "@/lib/connections/store";

const API = "https://business-api.tiktok.com/open_api/v1.3";

interface TikTokEnvelope<T> {
  code: number;
  message: string;
  data?: T;
}

async function ttGet<T>(
  path: string,
  params: Record<string, string>,
  token: string,
): Promise<T> {
  const res = await fetch(`${API}${path}?${new URLSearchParams(params)}`, {
    headers: { "Access-Token": token },
    signal: AbortSignal.timeout(45_000),
  });
  const json = (await res.json()) as TikTokEnvelope<T>;
  if (json.code !== 0) throw new Error(`TikTok API: ${json.message}`);
  return json.data as T;
}

export async function validateTikTokConnection(conn: TikTokConnection): Promise<string> {
  const data = await ttGet<{ list: { name?: string }[] }>(
    "/advertiser/info/",
    { advertiser_ids: JSON.stringify([conn.advertiserId]) },
    conn.accessToken,
  );
  const name = data.list?.[0]?.name;
  if (!name) throw new Error("Advertiser not accessible with this token");
  return name;
}

function* windows(from: string, to: string): Generator<{ from: string; to: string }> {
  let start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (start <= end) {
    const chunkEnd = new Date(Math.min(start.getTime() + 29 * 86_400_000, end.getTime()));
    yield {
      from: start.toISOString().slice(0, 10),
      to: chunkEnd.toISOString().slice(0, 10),
    };
    start = new Date(chunkEnd.getTime() + 86_400_000);
  }
}

interface ReportRow {
  dimensions: { campaign_id?: string; ad_id?: string; stat_time_day?: string };
  metrics: Record<string, string>;
}

async function report(
  conn: TikTokConnection,
  level: "AUCTION_CAMPAIGN" | "AUCTION_AD",
  from: string,
  to: string,
  filtering?: object[],
): Promise<ReportRow[]> {
  const rows: ReportRow[] = [];
  for (const w of windows(from, to)) {
    let page = 1;
    for (;;) {
      const data = await ttGet<{ list: ReportRow[]; page_info: { total_page: number } }>(
        "/report/integrated/get/",
        {
          advertiser_id: conn.advertiserId,
          report_type: "BASIC",
          data_level: level,
          dimensions: JSON.stringify(
            level === "AUCTION_CAMPAIGN"
              ? ["campaign_id", "stat_time_day"]
              : ["ad_id", "stat_time_day"],
          ),
          metrics: JSON.stringify([
            "spend",
            "impressions",
            "clicks",
            "conversion",
            "total_complete_payment_rate",
          ]),
          start_date: w.from,
          end_date: w.to,
          page: String(page),
          page_size: "1000",
          ...(filtering ? { filtering: JSON.stringify(filtering) } : {}),
        },
        conn.accessToken,
      );
      rows.push(...(data.list ?? []));
      if (page >= (data.page_info?.total_page ?? 1)) break;
      page++;
    }
  }
  return rows;
}

const cache = new Map<string, { at: number; campaigns: Campaign[]; metrics: DailyMetric[] }>();
const CACHE_TTL = 5 * 60_000;

async function loadAccount(conn: TikTokConnection, range: DateRange) {
  const cached = cache.get(conn.advertiserId);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached;

  const campData = await ttGet<{
    list: { campaign_id: string; campaign_name: string; operation_status: string; budget?: number; create_time?: string }[];
  }>(
    "/campaign/get/",
    { advertiser_id: conn.advertiserId, page_size: "100" },
    conn.accessToken,
  );

  const campaigns: Campaign[] = (campData.list ?? []).map((c) => ({
    id: c.campaign_id,
    platform: "tiktok",
    name: c.campaign_name,
    vertical: "other",
    status: c.operation_status === "ENABLE" ? "active" : "paused",
    objective: "—",
    dailyBudget: Math.round(c.budget ?? 0),
    launchedAt: c.create_time?.slice(0, 10) ?? "",
  }));

  const rows = await report(conn, "AUCTION_CAMPAIGN", range.from, range.to);
  const metrics: DailyMetric[] = rows
    .filter((r) => r.dimensions.campaign_id && r.dimensions.stat_time_day)
    .map((r) => ({
      date: r.dimensions.stat_time_day!.slice(0, 10),
      campaignId: r.dimensions.campaign_id!,
      spend: Number(r.metrics.spend ?? 0),
      revenue: 0, // value tracking is shop-specific; conservatively omitted
      impressions: Number(r.metrics.impressions ?? 0),
      clicks: Number(r.metrics.clicks ?? 0),
      conversions: Number(r.metrics.conversion ?? 0),
    }));

  const entry = { at: Date.now(), campaigns, metrics };
  cache.set(conn.advertiserId, entry);
  return entry;
}

export function createTikTokLiveAdapter(conn: TikTokConnection): PlatformAdapter {
  return {
    platform: "tiktok",
    mode: "live",

    async getCampaigns(): Promise<Campaign[]> {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 89 * 86_400_000).toISOString().slice(0, 10);
      return (await loadAccount(conn, { from, to })).campaigns;
    },

    async getDailyMetrics(range: DateRange, campaignId?: string): Promise<DailyMetric[]> {
      const { metrics } = await loadAccount(conn, range);
      return metrics.filter(
        (m) =>
          m.date >= range.from &&
          m.date <= range.to &&
          (campaignId === undefined || m.campaignId === campaignId),
      );
    },

    async getAds(campaignId: string): Promise<Ad[]> {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 89 * 86_400_000).toISOString().slice(0, 10);
      const rows = await report(conn, "AUCTION_AD", from, to, [
        { field_name: "campaign_ids", filter_type: "IN", filter_value: JSON.stringify([campaignId]) },
      ]);

      // aggregate ad-day rows into per-ad totals
      const byAd = new Map<string, Ad>();
      for (const r of rows) {
        const id = r.dimensions.ad_id;
        if (!id) continue;
        const acc =
          byAd.get(id) ??
          ({
            id,
            campaignId,
            name: `Ad ${id}`,
            format: "unknown",
            headline: "",
            hook: "",
            spend: 0,
            revenue: 0,
            impressions: 0,
            clicks: 0,
            conversions: 0,
          } satisfies Ad);
        acc.spend += Number(r.metrics.spend ?? 0);
        acc.impressions += Number(r.metrics.impressions ?? 0);
        acc.clicks += Number(r.metrics.clicks ?? 0);
        acc.conversions += Number(r.metrics.conversion ?? 0);
        byAd.set(id, acc);
      }
      return [...byAd.values()];
    },
  };
}
