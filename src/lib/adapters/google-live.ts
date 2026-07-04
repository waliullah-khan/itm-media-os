/**
 * LIVE Google Ads adapter — GAQL over the REST endpoint. Requires the four
 * credentials Google's API mandates (developer token, OAuth client pair,
 * refresh token) plus the customer ID; validated at connect time with a
 * one-row GAQL query.
 *
 * revenue maps from metrics.conversions_value (set by conversion value
 * tracking); accounts without value tracking report $0 revenue.
 */

import type {
  Ad,
  Campaign,
  DailyMetric,
  DateRange,
  PlatformAdapter,
} from "@/lib/adapters/types";
import type { GoogleAdsConnection } from "@/lib/connections/store";

const API = "https://googleads.googleapis.com/v21";

async function accessToken(conn: GoogleAdsConnection): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: conn.clientId,
      client_secret: conn.clientSecret,
      refresh_token: conn.refreshToken,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json()) as { access_token?: string; error_description?: string };
  if (!json.access_token) {
    throw new Error(`Google OAuth failed: ${json.error_description ?? res.status}`);
  }
  return json.access_token;
}

interface GaqlRow {
  campaign?: { id?: string; name?: string; status?: string; startDate?: string };
  campaignBudget?: { amountMicros?: string };
  adGroupAd?: { ad?: { id?: string; name?: string } };
  segments?: { date?: string };
  metrics?: {
    costMicros?: string;
    impressions?: string;
    clicks?: string;
    conversions?: number;
    conversionsValue?: number;
  };
  customer?: { descriptiveName?: string };
}

async function gaql(conn: GoogleAdsConnection, query: string): Promise<GaqlRow[]> {
  const token = await accessToken(conn);
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    "developer-token": conn.developerToken,
    "content-type": "application/json",
  };
  if (conn.loginCustomerId) headers["login-customer-id"] = conn.loginCustomerId;

  const rows: GaqlRow[] = [];
  let pageToken: string | undefined;
  do {
    const res: Response = await fetch(`${API}/customers/${conn.customerId}/googleAds:search`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, pageToken }),
      signal: AbortSignal.timeout(60_000),
    });
    const json = (await res.json()) as {
      results?: GaqlRow[];
      nextPageToken?: string;
      error?: { message: string };
    };
    if (json.error) throw new Error(`Google Ads API: ${json.error.message}`);
    rows.push(...(json.results ?? []));
    pageToken = json.nextPageToken;
  } while (pageToken && rows.length < 20_000);
  return rows;
}

export async function validateGoogleConnection(conn: GoogleAdsConnection): Promise<string> {
  const rows = await gaql(conn, "SELECT customer.descriptive_name FROM customer LIMIT 1");
  return rows[0]?.customer?.descriptiveName ?? `Google Ads ${conn.customerId}`;
}

const cache = new Map<string, { at: number; campaigns: Campaign[]; metrics: DailyMetric[] }>();
const CACHE_TTL = 5 * 60_000;

async function loadAccount(conn: GoogleAdsConnection, range: DateRange) {
  const cacheKey = conn.customerId;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached;

  const campaignRows = await gaql(
    conn,
    `SELECT campaign.id, campaign.name, campaign.status, campaign.start_date,
            campaign_budget.amount_micros
     FROM campaign WHERE campaign.status != 'REMOVED'`,
  );
  const campaigns: Campaign[] = campaignRows.map((r) => ({
    id: String(r.campaign?.id ?? ""),
    platform: "google",
    name: r.campaign?.name ?? "Campaign",
    vertical: "other",
    status: r.campaign?.status === "ENABLED" ? "active" : "paused",
    objective: "—",
    dailyBudget: r.campaignBudget?.amountMicros
      ? Math.round(Number(r.campaignBudget.amountMicros) / 1_000_000)
      : 0,
    launchedAt: r.campaign?.startDate ?? "",
  }));

  const metricRows = await gaql(
    conn,
    `SELECT segments.date, campaign.id, metrics.cost_micros, metrics.impressions,
            metrics.clicks, metrics.conversions, metrics.conversions_value
     FROM campaign
     WHERE segments.date BETWEEN '${range.from}' AND '${range.to}'`,
  );
  const metrics: DailyMetric[] = metricRows.map((r) => ({
    date: r.segments?.date ?? "",
    campaignId: String(r.campaign?.id ?? ""),
    spend: Number(r.metrics?.costMicros ?? 0) / 1_000_000,
    revenue: Number(r.metrics?.conversionsValue ?? 0),
    impressions: Number(r.metrics?.impressions ?? 0),
    clicks: Number(r.metrics?.clicks ?? 0),
    conversions: Number(r.metrics?.conversions ?? 0),
  }));

  const entry = { at: Date.now(), campaigns, metrics };
  cache.set(cacheKey, entry);
  return entry;
}

export function createGoogleLiveAdapter(conn: GoogleAdsConnection): PlatformAdapter {
  return {
    platform: "google",
    mode: "live",

    async getCampaigns(): Promise<Campaign[]> {
      // the metrics range is refetched with campaigns; use a rolling 90d
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
      const rows = await gaql(
        conn,
        `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, metrics.cost_micros,
                metrics.impressions, metrics.clicks, metrics.conversions,
                metrics.conversions_value
         FROM ad_group_ad
         WHERE campaign.id = ${Number(campaignId)} AND segments.date DURING LAST_30_DAYS`,
      );
      return rows.map((r) => ({
        id: String(r.adGroupAd?.ad?.id ?? "ad"),
        campaignId,
        name: r.adGroupAd?.ad?.name || `Ad ${r.adGroupAd?.ad?.id}`,
        format: "unknown" as const,
        headline: "",
        hook: "",
        spend: Number(r.metrics?.costMicros ?? 0) / 1_000_000,
        revenue: Number(r.metrics?.conversionsValue ?? 0),
        impressions: Number(r.metrics?.impressions ?? 0),
        clicks: Number(r.metrics?.clicks ?? 0),
        conversions: Number(r.metrics?.conversions ?? 0),
      }));
    },
  };
}
