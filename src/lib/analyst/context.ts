/**
 * Assembles the compact, structured context the AI Analyst reasons over.
 *
 * We never ship raw daily rows to the model — we send the same rollups the
 * dashboard renders (scorecard, platform split, per-campaign 30d vs prior-30d,
 * detected anomalies) so the analysis is cheap, fast, and grounded in numbers
 * the user can verify on screen.
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
import { getWorld } from "@/lib/data/world";
import { PLATFORM_LABELS, VERTICAL_LABELS } from "@/lib/adapters/types";

function line(label: string, t: Totals): string {
  const cpa = isFinite(t.cpa) ? `$${t.cpa.toFixed(2)}` : "n/a";
  return `${label}: spend $${Math.round(t.spend)}, revenue $${Math.round(
    t.revenue,
  )}, profit $${Math.round(t.profit)}, ROAS ${t.roas.toFixed(2)}x, leads ${Math.round(
    t.conversions,
  )}, CPA ${cpa}, CTR ${(t.ctr * 100).toFixed(2)}%, CPC $${t.cpc.toFixed(2)}`;
}

export async function buildAnalystContext(): Promise<string> {
  const { campaigns, metrics, end } = await getWorld();

  const sc = scorecard(metrics, end, 30);
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
      return `- ${c.name} [${PLATFORM_LABELS[c.platform]}, ${
        VERTICAL_LABELS[c.vertical]
      }, ${c.status}]\n    last30d — ${line("", cur).slice(2)}\n    prior30d — ${line("", prev).slice(2)}`;
    })
    .filter(Boolean)
    .join("\n");

  return `DATA WINDOW: 30 days ending ${end} (vs the 30 days before).

ACCOUNT SCORECARD
last30d — ${line("", sc.current).slice(2)}
prior30d — ${line("", sc.previous).slice(2)}

PLATFORM SPLIT (last 30d)
${platforms.map((p) => `- ${line(PLATFORM_LABELS[p.platform], p.totals)}`).join("\n")}

CAMPAIGNS (last 30d vs prior 30d)
${campaignLines}

DETECTED SIGNALS (rule-based, verify against the data)
${anomalies.map((a) => `- [${a.severity}] ${a.title}: ${a.detail}`).join("\n")}`;
}
