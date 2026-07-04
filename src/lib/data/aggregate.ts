/**
 * Pure aggregation over DailyMetric rows: rollups, period-over-period
 * scorecards, time series, and rule-of-thumb anomaly detection.
 *
 * Everything here is platform-agnostic — it consumes adapter output only.
 */

import type {
  Campaign,
  DailyMetric,
  DateRange,
  Platform,
} from "@/lib/adapters/types";

export interface Totals {
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  conversions: number;
  /** revenue - spend */
  profit: number;
  ctr: number;
  cvr: number;
  cpc: number;
  /** cost per lead; Infinity when no conversions */
  cpa: number;
  /** earnings per click */
  epc: number;
  roas: number;
}

export function sumMetrics(rows: DailyMetric[]): Totals {
  let spend = 0,
    revenue = 0,
    impressions = 0,
    clicks = 0,
    conversions = 0;
  for (const r of rows) {
    spend += r.spend;
    revenue += r.revenue;
    impressions += r.impressions;
    clicks += r.clicks;
    conversions += r.conversions;
  }
  return {
    spend,
    revenue,
    impressions,
    clicks,
    conversions,
    profit: revenue - spend,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cvr: clicks > 0 ? conversions / clicks : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpa: conversions > 0 ? spend / conversions : Infinity,
    epc: clicks > 0 ? revenue / clicks : 0,
    roas: spend > 0 ? revenue / spend : 0,
  };
}

export function inRange(rows: DailyMetric[], range: DateRange): DailyMetric[] {
  return rows.filter((r) => r.date >= range.from && r.date <= range.to);
}

/** ISO date `days` before `end` (both inclusive endpoints used by callers). */
export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The `days`-long window ending at `end`, plus the window before it. */
export function windowPair(end: string, days: number): {
  current: DateRange;
  previous: DateRange;
} {
  return {
    current: { from: shiftDate(end, -(days - 1)), to: end },
    previous: { from: shiftDate(end, -(2 * days - 1)), to: shiftDate(end, -days) },
  };
}

export interface Scorecard {
  current: Totals;
  previous: Totals;
  range: DateRange;
}

export function scorecard(
  rows: DailyMetric[],
  end: string,
  days: number,
): Scorecard {
  const { current, previous } = windowPair(end, days);
  return {
    current: sumMetrics(inRange(rows, current)),
    previous: sumMetrics(inRange(rows, previous)),
    range: current,
  };
}

export function groupBy<K extends string>(
  rows: DailyMetric[],
  key: (r: DailyMetric) => K,
): Record<K, DailyMetric[]> {
  const out = {} as Record<K, DailyMetric[]>;
  for (const r of rows) {
    (out[key(r)] ??= []).push(r);
  }
  return out;
}

export function byPlatform(
  rows: DailyMetric[],
  campaigns: Campaign[],
): { platform: Platform; totals: Totals }[] {
  const platformOf = new Map(campaigns.map((c) => [c.id, c.platform]));
  const grouped = groupBy(rows, (r) => platformOf.get(r.campaignId) ?? "google");
  return (Object.entries(grouped) as [Platform, DailyMetric[]][])
    .map(([platform, g]) => ({ platform, totals: sumMetrics(g) }))
    .sort((a, b) => b.totals.spend - a.totals.spend);
}

export function byCampaign(
  rows: DailyMetric[],
): { campaignId: string; totals: Totals }[] {
  const grouped = groupBy(rows, (r) => r.campaignId);
  return Object.entries(grouped)
    .map(([campaignId, g]) => ({ campaignId, totals: sumMetrics(g) }))
    .sort((a, b) => b.totals.profit - a.totals.profit);
}

export interface SeriesPoint {
  date: string;
  spend: number;
  revenue: number;
  profit: number;
  conversions: number;
}

/** One point per day, summed across the given rows. */
export function dailySeries(rows: DailyMetric[]): SeriesPoint[] {
  const grouped = groupBy(rows, (r) => r.date);
  return Object.entries(grouped)
    .map(([date, g]) => {
      const t = sumMetrics(g);
      return {
        date,
        spend: Math.round(t.spend),
        revenue: Math.round(t.revenue),
        profit: Math.round(t.profit),
        conversions: Math.round(t.conversions),
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ---------------------------------------------------------------------------
// Anomaly detection — deliberately simple, explainable heuristics.
// ---------------------------------------------------------------------------

export type AnomalyKind =
  | "ctr-decay"
  | "cpc-inflation"
  | "scale-opportunity"
  | "spend-crash"
  | "weekend-cvr";

export interface Anomaly {
  kind: AnomalyKind;
  campaignId: string;
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string;
  /** e.g. "-38% CTR (21d)" — short evidence string for chips */
  evidence: string;
}

/**
 * Compare a metric's mean over the last `n` days vs the `n` days before.
 * Returns relative change, or null if either window is empty.
 */
function windowChange(
  rows: DailyMetric[],
  end: string,
  n: number,
  metric: (t: Totals) => number,
): number | null {
  const { current, previous } = windowPair(end, n);
  const cur = metric(sumMetrics(inRange(rows, current)));
  const prev = metric(sumMetrics(inRange(rows, previous)));
  if (!isFinite(cur) || !isFinite(prev) || prev === 0) return null;
  return (cur - prev) / prev;
}

export function detectAnomalies(
  rows: DailyMetric[],
  campaigns: Campaign[],
  end: string,
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const grouped = groupBy(rows, (r) => r.campaignId);

  for (const c of campaigns) {
    if (c.status !== "active") continue;
    const cRows = grouped[c.id];
    if (!cRows || cRows.length < 28) continue;

    const last14 = sumMetrics(
      inRange(cRows, { from: shiftDate(end, -13), to: end }),
    );

    // Creative fatigue: CTR down sharply over 3 weeks while spend held.
    const ctrChange = windowChange(cRows, end, 21, (t) => t.ctr);
    if (ctrChange !== null && ctrChange < -0.2) {
      anomalies.push({
        kind: "ctr-decay",
        campaignId: c.id,
        severity: ctrChange < -0.3 ? "critical" : "warn",
        title: "Creative fatigue",
        detail: `${c.name}: CTR fell ${Math.round(-ctrChange * 100)}% vs the prior 3 weeks while spend held steady — classic creative burnout. Rotate new creative or cut spend until refreshed.`,
        evidence: `${Math.round(ctrChange * 100)}% CTR (21d)`,
      });
    }

    // Auction pressure: CPC up >15% over 30 days.
    const cpcChange = windowChange(cRows, end, 30, (t) => t.cpc);
    if (cpcChange !== null && cpcChange > 0.15) {
      anomalies.push({
        kind: "cpc-inflation",
        campaignId: c.id,
        severity: cpcChange > 0.25 ? "critical" : "warn",
        title: "CPC inflation",
        detail: `${c.name}: CPC is up ${Math.round(cpcChange * 100)}% over 30 days — auction pressure is compressing margin. Revisit bids, keywords, or shift budget to cheaper inventory.`,
        evidence: `+${Math.round(cpcChange * 100)}% CPC (30d)`,
      });
    }

    // Under-scaled winner: strong ROAS on flat spend.
    const spendChange = windowChange(cRows, end, 21, (t) => t.spend);
    if (
      last14.roas > 2.2 &&
      last14.spend > 1500 &&
      spendChange !== null &&
      Math.abs(spendChange) < 0.12
    ) {
      anomalies.push({
        kind: "scale-opportunity",
        campaignId: c.id,
        severity: "info",
        title: "Under-scaled winner",
        detail: `${c.name}: ${last14.roas.toFixed(2)}x ROAS over the last 14 days with spend flat for 3 weeks. Test +20–30% budget — every unspent day forfeits ~$${Math.round(last14.profit / 14)} profit/day of headroom.`,
        evidence: `${last14.roas.toFixed(2)}x ROAS, flat spend`,
      });
    }

    // Spend crash: campaign fell off a cliff vs its own prior month.
    const spendChange30 = windowChange(cRows, end, 30, (t) => t.spend);
    if (spendChange30 !== null && spendChange30 < -0.45) {
      anomalies.push({
        kind: "spend-crash",
        campaignId: c.id,
        severity: "warn",
        title: "Delivery collapsed",
        detail: `${c.name}: spend is down ${Math.round(-spendChange30 * 100)}% vs the prior 30 days — a spike-and-burnout pattern. Decide: relaunch with fresh creative or kill and reallocate.`,
        evidence: `${Math.round(spendChange30 * 100)}% spend (30d)`,
      });
    }

    // Dayparting: weekend CVR meaningfully above weekday CVR (last 28d).
    const recent = inRange(cRows, { from: shiftDate(end, -27), to: end });
    const weekendRows = recent.filter((r) => {
      const dow = new Date(`${r.date}T00:00:00Z`).getUTCDay();
      return dow === 0 || dow === 6;
    });
    const weekdayRows = recent.filter((r) => !weekendRows.includes(r));
    const wend = sumMetrics(weekendRows);
    const wday = sumMetrics(weekdayRows);
    if (
      wend.clicks > 200 &&
      wday.cvr > 0 &&
      wend.cvr / wday.cvr > 1.25
    ) {
      anomalies.push({
        kind: "weekend-cvr",
        campaignId: c.id,
        severity: "info",
        title: "Dayparting opportunity",
        detail: `${c.name}: weekend CVR is ${Math.round((wend.cvr / wday.cvr - 1) * 100)}% higher than weekdays over the last 4 weeks. Add a weekend bid boost or shift budget into Sat–Sun.`,
        evidence: `+${Math.round((wend.cvr / wday.cvr - 1) * 100)}% weekend CVR`,
      });
    }
  }

  const rank = { critical: 0, warn: 1, info: 2 };
  return anomalies.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
