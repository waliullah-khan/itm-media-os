/**
 * Convenience facade the pages use: pulls every platform's data through the
 * adapter registry and joins it into one cross-platform view.
 *
 * Reads the visitor's connection cookie — a connected platform (e.g. a real
 * Meta account) is served by its live adapter; everything else stays seeded.
 * Live pulls that fail fall back to the seeded adapter so the app never
 * breaks on an expired token.
 */

import type { Ad, Campaign, DailyMetric, DateRange } from "@/lib/adapters/types";
import { getAdapter, getAllAdapters } from "@/lib/adapters/registry";
import { createSeededAdapter } from "@/lib/adapters/seeded";
import { getConnections } from "@/lib/connections/store";
import { getDataset } from "@/lib/data/generate";

export interface World {
  campaigns: Campaign[];
  metrics: DailyMetric[];
  /** last date with data — treated as "today" everywhere */
  end: string;
  start: string;
  /** platforms currently served by a live adapter */
  livePlatforms: string[];
}

export async function getWorld(range?: DateRange): Promise<World> {
  const { start, end } = getDataset();
  const effective = range ?? { from: start, to: end };
  const connections = await getConnections();

  const adapters = getAllAdapters(connections);
  const results = await Promise.all(
    adapters.map(async (a) => {
      try {
        const [campaigns, metrics] = await Promise.all([
          a.getCampaigns(),
          a.getDailyMetrics(effective),
        ]);
        return { campaigns, metrics, live: a.mode === "live", platform: a.platform };
      } catch {
        // live adapter failed (expired token, API hiccup) — degrade to seeded
        const fallback = createSeededAdapter(a.platform);
        return {
          campaigns: await fallback.getCampaigns(),
          metrics: await fallback.getDailyMetrics(effective),
          live: false,
          platform: a.platform,
        };
      }
    }),
  );

  return {
    campaigns: results.flatMap((r) => r.campaigns),
    metrics: results.flatMap((r) => r.metrics),
    start,
    end,
    livePlatforms: results.filter((r) => r.live).map((r) => r.platform),
  };
}

export async function getCampaignAds(campaign: Campaign): Promise<Ad[]> {
  const connections = await getConnections();
  const adapter = getAdapter(campaign.platform, connections);
  try {
    return await adapter.getAds(campaign.id);
  } catch {
    return [];
  }
}
