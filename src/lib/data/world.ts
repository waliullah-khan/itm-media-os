/**
 * Convenience facade the pages use: pulls platform data through the adapter
 * registry and joins it into one cross-platform view.
 *
 * The board has two modes (see lib/connections/mode.ts):
 *  - seeded: the demo dataset for all four platforms. Connections and
 *    visitor keys are ignored entirely — nothing private can surface here.
 *  - live:   ONLY platforms the visitor has connected. Unconnected platforms
 *    contribute nothing (no seeded fallback), so the live board is empty
 *    until real accounts are connected.
 */

import type { Ad, Campaign, DailyMetric, DateRange, Platform } from "@/lib/adapters/types";
import { PLATFORMS } from "@/lib/adapters/types";
import { getAdapter } from "@/lib/adapters/registry";
import { getConnections } from "@/lib/connections/store";
import { getMode, type BoardMode } from "@/lib/connections/mode";
import { getDataset } from "@/lib/data/generate";

export interface World {
  mode: BoardMode;
  campaigns: Campaign[];
  metrics: DailyMetric[];
  /** last date with data — treated as "today" everywhere */
  end: string;
  start: string;
  /** platforms currently served by a live adapter */
  livePlatforms: Platform[];
  /** live mode with zero connected accounts → boards render an empty state */
  liveEmpty: boolean;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysBefore(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function getWorld(range?: DateRange): Promise<World> {
  const mode = await getMode();
  const dataset = getDataset();

  // ---- SEEDED MODE: the demo dataset, no connections consulted ----
  if (mode === "seeded") {
    const window = range ?? { from: dataset.start, to: dataset.end };
    const adapters = PLATFORMS.map((p) => getAdapter(p, {}));
    const results = await Promise.all(
      adapters.map(async (a) => ({
        campaigns: await a.getCampaigns(),
        metrics: await a.getDailyMetrics(window),
      })),
    );
    return {
      mode,
      campaigns: results.flatMap((r) => r.campaigns),
      metrics: results.flatMap((r) => r.metrics),
      start: dataset.start,
      end: dataset.end,
      livePlatforms: [],
      liveEmpty: false,
    };
  }

  // ---- LIVE MODE: only connected accounts ----
  const connections = await getConnections();
  const connectedPlatforms = PLATFORMS.filter((p) => connections[p]);
  const end = todayIso();
  const start = isoDaysBefore(end, 89);
  const window = range ?? { from: start, to: end };

  if (connectedPlatforms.length === 0) {
    return { mode, campaigns: [], metrics: [], start, end, livePlatforms: [], liveEmpty: true };
  }

  const results = await Promise.all(
    connectedPlatforms.map(async (p) => {
      try {
        const a = getAdapter(p, connections);
        const [campaigns, metrics] = await Promise.all([
          a.getCampaigns(),
          a.getDailyMetrics(window),
        ]);
        return { campaigns, metrics, platform: p, ok: true };
      } catch {
        // an expired token / API hiccup shouldn't blank the whole board
        return { campaigns: [], metrics: [], platform: p, ok: false };
      }
    }),
  );

  const metrics = results.flatMap((r) => r.metrics);
  // anchor the window to the freshest real data we actually pulled
  const latest = metrics.reduce((m, r) => (r.date > m ? r.date : m), start);

  return {
    mode,
    campaigns: results.flatMap((r) => r.campaigns),
    metrics,
    start: isoDaysBefore(latest, 89),
    end: latest,
    livePlatforms: results.filter((r) => r.ok).map((r) => r.platform),
    liveEmpty: false,
  };
}

export async function getCampaignAds(campaign: Campaign): Promise<Ad[]> {
  const mode = await getMode();
  const connections = mode === "live" ? await getConnections() : {};
  const adapter = getAdapter(campaign.platform, connections);
  try {
    return await adapter.getAds(campaign.id);
  } catch {
    return [];
  }
}
