/**
 * LIVE Meta adapter — pulls real campaigns and daily insights from the
 * Marketing API (Graph v23.0) for a connected ad account, mapped onto the
 * same PlatformAdapter interface the seeded adapters implement. Connect a
 * Meta account on /connections and every module reads real delivery.
 *
 * Notes on mapping affiliate economics onto Meta's schema:
 *  - conversions  = lead-type actions when present, else purchases
 *  - revenue      = purchase conversion value when the pixel reports it;
 *                   accounts without value tracking will show $0 revenue
 *                   (dashboards handle it — profit simply reads as -spend)
 */

import type {
  Ad,
  Campaign,
  DailyMetric,
  DateRange,
  PlatformAdapter,
} from "@/lib/adapters/types";
import type { MetaConnection } from "@/lib/connections/store";

const GRAPH = "https://graph.facebook.com/v23.0";

interface GraphPaged<T> {
  data: T[];
  paging?: { next?: string };
  error?: { message: string; code: number };
}

async function graphGet<T>(path: string, params: Record<string, string>, token: string): Promise<T[]> {
  const search = new URLSearchParams({ ...params, access_token: token, limit: "500" });
  let url: string | undefined = `${GRAPH}/${path}?${search}`;
  const out: T[] = [];
  let hops = 0;

  while (url && hops < 10) {
    const res: Response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    const json = (await res.json()) as GraphPaged<T>;
    if (json.error) throw new Error(`Meta API: ${json.error.message}`);
    out.push(...(json.data ?? []));
    url = json.paging?.next;
    hops++;
  }
  return out;
}

interface InsightAction {
  action_type: string;
  value: string;
}

interface InsightRow {
  date_start: string;
  campaign_id?: string;
  ad_id?: string;
  ad_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: InsightAction[];
  action_values?: InsightAction[];
}

const LEAD_TYPES = ["lead", "offsite_conversion.fb_pixel_lead", "onsite_conversion.lead_grouped"];
const PURCHASE_TYPES = ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"];

function pickConversions(actions: InsightAction[] | undefined): number {
  if (!actions) return 0;
  const sum = (types: string[]) =>
    actions.filter((a) => types.includes(a.action_type)).reduce((s, a) => s + Number(a.value), 0);
  const leads = sum(LEAD_TYPES);
  return leads > 0 ? leads : sum(PURCHASE_TYPES);
}

function pickRevenue(values: InsightAction[] | undefined): number {
  if (!values) return 0;
  return values
    .filter((a) => PURCHASE_TYPES.includes(a.action_type))
    .reduce((s, a) => s + Number(a.value), 0);
}

function toMetric(row: InsightRow, campaignId: string): DailyMetric {
  return {
    date: row.date_start,
    campaignId,
    spend: Number(row.spend ?? 0),
    revenue: pickRevenue(row.action_values),
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    conversions: pickConversions(row.actions),
  };
}

/** Validates a token + account pair; returns the account name. */
export async function validateMetaConnection(
  accessToken: string,
  accountId: string,
): Promise<string> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const res = await fetch(
    `${GRAPH}/${id}?fields=name,account_status&access_token=${encodeURIComponent(accessToken)}`,
    { signal: AbortSignal.timeout(15_000) },
  );
  const json = (await res.json()) as { name?: string; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.name ?? id;
}

/** Module-level cache: live pulls are slow; one refresh per account per 5 min. */
const cache = new Map<string, { at: number; campaigns: Campaign[]; metrics: DailyMetric[] }>();
const CACHE_TTL = 5 * 60_000;

async function loadAccount(conn: MetaConnection) {
  const cached = cache.get(conn.accountId);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached;

  const rawCampaigns = await graphGet<{
    id: string;
    name: string;
    status: string;
    daily_budget?: string;
    objective?: string;
    start_time?: string;
  }>(`${conn.accountId}/campaigns`, { fields: "name,status,daily_budget,objective,start_time" }, conn.accessToken);

  const campaigns: Campaign[] = rawCampaigns.map((c) => ({
    id: c.id,
    platform: "meta",
    name: c.name,
    vertical: "other",
    status: c.status === "ACTIVE" ? "active" : "paused",
    objective: c.objective?.replaceAll("_", " ").toLowerCase() ?? "—",
    dailyBudget: c.daily_budget ? Math.round(Number(c.daily_budget) / 100) : 0,
    launchedAt: c.start_time?.slice(0, 10) ?? "",
  }));

  const rows = await graphGet<InsightRow>(
    `${conn.accountId}/insights`,
    {
      level: "campaign",
      fields: "campaign_id,spend,impressions,clicks,actions,action_values",
      date_preset: "last_90d",
      time_increment: "1",
    },
    conn.accessToken,
  );
  const metrics = rows
    .filter((r) => r.campaign_id)
    .map((r) => toMetric(r, r.campaign_id!));

  const entry = { at: Date.now(), campaigns, metrics };
  cache.set(conn.accountId, entry);
  return entry;
}

export function createMetaLiveAdapter(conn: MetaConnection): PlatformAdapter {
  return {
    platform: "meta",
    mode: "live",

    async getCampaigns(): Promise<Campaign[]> {
      return (await loadAccount(conn)).campaigns;
    },

    async getDailyMetrics(range: DateRange, campaignId?: string): Promise<DailyMetric[]> {
      const { metrics } = await loadAccount(conn);
      return metrics.filter(
        (m) =>
          m.date >= range.from &&
          m.date <= range.to &&
          (campaignId === undefined || m.campaignId === campaignId),
      );
    },

    async getAds(campaignId: string): Promise<Ad[]> {
      const rows = await graphGet<InsightRow>(
        `${conn.accountId}/insights`,
        {
          level: "ad",
          fields: "ad_id,ad_name,spend,impressions,clicks,actions,action_values",
          date_preset: "last_90d",
          filtering: JSON.stringify([
            { field: "campaign.id", operator: "EQUAL", value: campaignId },
          ]),
        },
        conn.accessToken,
      );
      return rows.map((r) => ({
        id: r.ad_id ?? "ad",
        campaignId,
        name: r.ad_name ?? "Ad",
        format: "unknown",
        headline: "",
        hook: "",
        spend: Number(r.spend ?? 0),
        revenue: pickRevenue(r.action_values),
        impressions: Number(r.impressions ?? 0),
        clicks: Number(r.clicks ?? 0),
        conversions: pickConversions(r.actions),
      }));
    },
  };
}
