/**
 * Context assembly for report templates — same grounding philosophy as the
 * AI Analyst (rollups, not raw rows), with a platform scope and ad-level
 * detail for creative-oriented reports.
 */

import {
  byPlatform,
  detectAnomalies,
  groupBy,
  inRange,
  scorecard,
  sumMetrics,
  windowPair,
  type Totals,
} from "@/lib/data/aggregate";
import { getWorld, getCampaignAds } from "@/lib/data/world";
import {
  PLATFORM_LABELS,
  VERTICAL_LABELS,
  type Platform,
} from "@/lib/adapters/types";

function line(t: Totals): string {
  const cpa = isFinite(t.cpa) ? `$${t.cpa.toFixed(2)}` : "n/a";
  return `spend $${Math.round(t.spend)}, revenue $${Math.round(t.revenue)}, profit $${Math.round(
    t.profit,
  )}, ROAS ${t.roas.toFixed(2)}x, leads ${Math.round(t.conversions)}, CPA ${cpa}, CTR ${(
    t.ctr * 100
  ).toFixed(2)}%, CPC $${t.cpc.toFixed(2)}`;
}

export async function buildReportContext(options: {
  platform?: Platform;
  includeAds?: boolean;
}): Promise<string> {
  const world = await getWorld();
  const campaigns = options.platform
    ? world.campaigns.filter((c) => c.platform === options.platform)
    : world.campaigns;
  const ids = new Set(campaigns.map((c) => c.id));
  const metrics = world.metrics.filter((m) => ids.has(m.campaignId));
  const { end } = world;

  const sc30 = scorecard(metrics, end, 30);
  const sc7 = scorecard(metrics, end, 7);
  const rows30 = inRange(metrics, windowPair(end, 30).current);
  const rowsPrev30 = inRange(metrics, windowPair(end, 30).previous);
  const platforms = byPlatform(rows30, campaigns);
  const anomalies = detectAnomalies(metrics, campaigns, end);

  const grouped30 = groupBy(rows30, (r) => r.campaignId);
  const groupedPrev = groupBy(rowsPrev30, (r) => r.campaignId);

  const campaignLines = campaigns
    .map((c) => {
      const cur = sumMetrics(grouped30[c.id] ?? []);
      const prev = sumMetrics(groupedPrev[c.id] ?? []);
      if (cur.spend === 0 && prev.spend === 0) return null;
      return `- ${c.name} [${PLATFORM_LABELS[c.platform]}, ${VERTICAL_LABELS[c.vertical]}, ${c.status}, budget $${c.dailyBudget}/day]
    last30d — ${line(cur)}
    prior30d — ${line(prev)}`;
    })
    .filter(Boolean)
    .join("\n");

  let adSection = "";
  if (options.includeAds) {
    const top = campaigns
      .map((c) => ({ c, t: sumMetrics(grouped30[c.id] ?? []) }))
      .sort((a, b) => b.t.spend - a.t.spend)
      .slice(0, 6);
    const adLines: string[] = [];
    for (const { c } of top) {
      const ads = await getCampaignAds(c);
      for (const ad of ads.slice(0, 4)) {
        const roas = ad.spend > 0 ? (ad.revenue / ad.spend).toFixed(2) : "0";
        adLines.push(
          `- [${c.name}] "${ad.name}" format=${ad.format} headline="${ad.headline}" hook="${ad.hook}" spend=$${Math.round(
            ad.spend,
          )} roas=${roas}x leads=${Math.round(ad.conversions)}`,
        );
      }
    }
    adSection = `\n\nTOP ADS (lifetime in window, across the biggest campaigns)\n${adLines.join("\n")}`;
  }

  const scope = options.platform
    ? `${PLATFORM_LABELS[options.platform]} only`
    : "all platforms";

  return `SCOPE: ${scope}. Windows end ${end}.

30-DAY SCORECARD (vs prior 30)
last30d — ${line(sc30.current)}
prior30d — ${line(sc30.previous)}

7-DAY SCORECARD (vs prior 7)
last7d — ${line(sc7.current)}
prior7d — ${line(sc7.previous)}

PLATFORM SPLIT (last 30d)
${platforms.map((p) => `- ${PLATFORM_LABELS[p.platform]}: ${line(p.totals)}`).join("\n")}

CAMPAIGNS (last 30d vs prior 30d)
${campaignLines}

DETECTED SIGNALS (rule-based, verify against the data)
${anomalies.map((a) => `- [${a.severity}] ${a.title}: ${a.detail}`).join("\n")}${adSection}`;
}
