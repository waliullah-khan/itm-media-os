/**
 * LIVE Taboola adapter — Backstage API with client-credentials OAuth.
 * Validated at connect time by minting a token and listing allowed accounts.
 *
 * revenue maps from the campaign-day report's conversions_value when the
 * account has value postbacks; otherwise $0.
 */

import type {
  Ad,
  Campaign,
  DailyMetric,
  DateRange,
  PlatformAdapter,
} from "@/lib/adapters/types";
import type { TaboolaConnection } from "@/lib/connections/store";

const API = "https://backstage.taboola.com/backstage";

async function backstageToken(conn: TaboolaConnection): Promise<string> {
  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: conn.clientId,
      client_secret: conn.clientSecret,
      grant_type: "client_credentials",
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error(`Taboola OAuth failed (${res.status})`);
  return json.access_token;
}

async function bsGet<T>(path: string, conn: TaboolaConnection): Promise<T> {
  const token = await backstageToken(conn);
  const res = await fetch(`${API}/api/1.0/${path}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Taboola API ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export async function validateTaboolaConnection(conn: TaboolaConnection): Promise<string> {
  const data = await bsGet<{ results: { account_id: string; name: string }[] }>(
    "users/current/allowed-accounts/",
    conn,
  );
  const account = data.results?.find((a) => a.account_id === conn.accountId);
  if (!account) {
    throw new Error(
      `Account "${conn.accountId}" not in this client's allowed accounts (${data.results
        ?.slice(0, 5)
        .map((a) => a.account_id)
        .join(", ")})`,
    );
  }
  return account.name;
}

interface TaboolaReportRow {
  date: string;
  campaign?: string;
  campaign_name?: string;
  item?: string;
  item_name?: string;
  spent?: number;
  impressions?: number;
  clicks?: number;
  cpa_actions_num?: number;
  conversions_value?: number;
}

const cache = new Map<string, { at: number; campaigns: Campaign[]; metrics: DailyMetric[] }>();
const CACHE_TTL = 5 * 60_000;

async function loadAccount(conn: TaboolaConnection, range: DateRange) {
  const cached = cache.get(conn.accountId);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached;

  const campData = await bsGet<{
    results: { id: string; name: string; is_active: boolean; daily_cap?: number; start_date?: string }[];
  }>(`${conn.accountId}/campaigns/`, conn);

  const campaigns: Campaign[] = (campData.results ?? []).map((c) => ({
    id: String(c.id),
    platform: "taboola",
    name: c.name,
    vertical: "other",
    status: c.is_active ? "active" : "paused",
    objective: "—",
    dailyBudget: Math.round(c.daily_cap ?? 0),
    launchedAt: c.start_date ?? "",
  }));

  const reportData = await bsGet<{ results: TaboolaReportRow[] }>(
    `${conn.accountId}/reports/campaign-summary/dimensions/campaign_day_breakdown?start_date=${range.from}&end_date=${range.to}`,
    conn,
  );
  const metrics: DailyMetric[] = (reportData.results ?? [])
    .filter((r) => r.campaign && r.date)
    .map((r) => ({
      date: r.date.slice(0, 10),
      campaignId: String(r.campaign),
      spend: Number(r.spent ?? 0),
      revenue: Number(r.conversions_value ?? 0),
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
      conversions: Number(r.cpa_actions_num ?? 0),
    }));

  const entry = { at: Date.now(), campaigns, metrics };
  cache.set(conn.accountId, entry);
  return entry;
}

export function createTaboolaLiveAdapter(conn: TaboolaConnection): PlatformAdapter {
  return {
    platform: "taboola",
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
      const data = await bsGet<{ results: TaboolaReportRow[] }>(
        `${conn.accountId}/reports/top-campaign-content/dimensions/item_breakdown?start_date=${from}&end_date=${to}&campaign=${encodeURIComponent(campaignId)}`,
        conn,
      );
      return (data.results ?? []).map((r) => ({
        id: String(r.item ?? "item"),
        campaignId,
        name: r.item_name ?? `Item ${r.item}`,
        format: "native" as const,
        headline: r.item_name ?? "",
        hook: "",
        spend: Number(r.spent ?? 0),
        revenue: Number(r.conversions_value ?? 0),
        impressions: Number(r.impressions ?? 0),
        clicks: Number(r.clicks ?? 0),
        conversions: Number(r.cpa_actions_num ?? 0),
      }));
    },
  };
}
