/**
 * Seeded adapter: serves the deterministic demo dataset through the same
 * interface a live platform integration would implement.
 *
 * A production Google Ads adapter, for example, would implement
 * `PlatformAdapter` with GAQL queries behind `getDailyMetrics` — no other
 * code in the app changes.
 */

import type {
  Ad,
  Campaign,
  DailyMetric,
  DateRange,
  Platform,
  PlatformAdapter,
} from "@/lib/adapters/types";
import { getDataset } from "@/lib/data/generate";
import { inRange } from "@/lib/data/aggregate";

export function createSeededAdapter(platform: Platform): PlatformAdapter {
  return {
    platform,
    mode: "seeded",

    async getCampaigns(): Promise<Campaign[]> {
      return getDataset().campaigns.filter((c) => c.platform === platform);
    },

    async getDailyMetrics(
      range: DateRange,
      campaignId?: string,
    ): Promise<DailyMetric[]> {
      const { campaigns, metrics } = getDataset();
      const mine = new Set(
        campaigns.filter((c) => c.platform === platform).map((c) => c.id),
      );
      return inRange(metrics, range).filter(
        (m) =>
          mine.has(m.campaignId) &&
          (campaignId === undefined || m.campaignId === campaignId),
      );
    },

    async getAds(campaignId: string): Promise<Ad[]> {
      return getDataset().ads.filter((a) => a.campaignId === campaignId);
    },
  };
}
