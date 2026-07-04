/**
 * Convenience facade the pages use: pulls every platform's data through the
 * adapter registry and joins it into one cross-platform view.
 */

import type { Ad, Campaign, DailyMetric, DateRange } from "@/lib/adapters/types";
import { getAllAdapters } from "@/lib/adapters/registry";
import { getDataset } from "@/lib/data/generate";

export interface World {
  campaigns: Campaign[];
  metrics: DailyMetric[];
  /** last date with data — treated as "today" everywhere */
  end: string;
  start: string;
}

export async function getWorld(range?: DateRange): Promise<World> {
  const { start, end } = getDataset();
  const effective = range ?? { from: start, to: end };

  const adapters = getAllAdapters();
  const campaignLists = await Promise.all(adapters.map((a) => a.getCampaigns()));
  const metricLists = await Promise.all(
    adapters.map((a) => a.getDailyMetrics(effective)),
  );

  return {
    campaigns: campaignLists.flat(),
    metrics: metricLists.flat(),
    start,
    end,
  };
}

export async function getCampaignAds(
  campaign: Campaign,
): Promise<Ad[]> {
  const adapter = getAllAdapters().find((a) => a.platform === campaign.platform);
  return adapter ? adapter.getAds(campaign.id) : [];
}
