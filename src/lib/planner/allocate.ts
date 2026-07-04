/**
 * Media planner: fits a diminishing-returns curve per campaign from recent
 * delivery and allocates a total daily budget by marginal ROAS.
 *
 * Model: revenue(s) = a * s^ELASTICITY (concave — each extra dollar buys a
 * little less). `a` is calibrated so the curve passes through the campaign's
 * observed 14-day average spend/revenue point. Allocation is greedy in $25
 * steps: each step goes to the campaign with the highest marginal ROAS,
 * bounded per campaign to [30%, 250%] of its current spend so the plan stays
 * executable (platforms punish violent budget swings).
 */

import type { Campaign, DailyMetric } from "@/lib/adapters/types";
import { groupBy, inRange, shiftDate, sumMetrics } from "@/lib/data/aggregate";

export const ELASTICITY = 0.85;
const STEP = 25;
const MIN_FACTOR = 0.3;
const MAX_FACTOR = 2.5;

export interface CampaignCurve {
  campaignId: string;
  name: string;
  platform: Campaign["platform"];
  /** observed average daily spend, last 14d */
  currentDaily: number;
  /** revenue(s) = a * s^ELASTICITY */
  a: number;
  /** observed leads per revenue-dollar, to project lead volume */
  leadsPerRevenue: number;
}

export interface Allocation {
  campaignId: string;
  name: string;
  platform: Campaign["platform"];
  currentDaily: number;
  plannedDaily: number;
  projRevenue: number;
  projProfit: number;
  projLeads: number;
  marginalRoas: number;
}

export interface Plan {
  totalBudget: number;
  allocations: Allocation[];
  projRevenue: number;
  projProfit: number;
  projLeads: number;
  /** what current spend levels would produce under the same curves */
  baseline: { spend: number; revenue: number; profit: number };
}

export function revenueAt(curve: CampaignCurve, spend: number): number {
  return spend <= 0 ? 0 : curve.a * Math.pow(spend, ELASTICITY);
}

export function marginalRoas(curve: CampaignCurve, spend: number): number {
  // d/ds [a * s^e] = a * e * s^(e-1); use a small floor to avoid the s→0 blowup
  const s = Math.max(spend, STEP);
  return curve.a * ELASTICITY * Math.pow(s, ELASTICITY - 1);
}

/** Fit curves from the last 14 days of delivery. Campaigns without meaningful
 * spend are excluded — there is nothing to calibrate on. */
export function fitCurves(
  campaigns: Campaign[],
  metrics: DailyMetric[],
  end: string,
): CampaignCurve[] {
  const grouped = groupBy(metrics, (r) => r.campaignId);
  const window = { from: shiftDate(end, -13), to: end };

  return campaigns
    .filter((c) => c.status === "active")
    .flatMap((c) => {
      const rows = grouped[c.id];
      if (!rows) return [];
      const t = sumMetrics(inRange(rows, window));
      if (t.spend < 200 || t.revenue <= 0) return [];
      const daily = t.spend / 14;
      return [
        {
          campaignId: c.id,
          name: c.name,
          platform: c.platform,
          currentDaily: Math.round(daily),
          a: t.revenue / 14 / Math.pow(daily, ELASTICITY),
          leadsPerRevenue: t.conversions / t.revenue,
        },
      ];
    });
}

export function allocate(curves: CampaignCurve[], totalBudget: number): Plan {
  const floors = new Map(
    curves.map((c) => [c.campaignId, Math.round((c.currentDaily * MIN_FACTOR) / STEP) * STEP]),
  );
  const caps = new Map(
    curves.map((c) => [c.campaignId, Math.round((c.currentDaily * MAX_FACTOR) / STEP) * STEP]),
  );

  const spend = new Map<string, number>();
  let remaining = totalBudget;

  // Seed each campaign at its floor (never zero out a running campaign).
  for (const c of curves) {
    const floor = Math.min(floors.get(c.campaignId)!, remaining);
    spend.set(c.campaignId, floor);
    remaining -= floor;
  }

  // Greedy: each $STEP goes to the highest marginal-ROAS campaign under cap.
  while (remaining >= STEP) {
    let best: CampaignCurve | null = null;
    let bestMarginal = -Infinity;
    for (const c of curves) {
      const s = spend.get(c.campaignId)!;
      if (s + STEP > caps.get(c.campaignId)!) continue;
      const m = marginalRoas(c, s);
      if (m > bestMarginal) {
        bestMarginal = m;
        best = c;
      }
    }
    if (!best) break; // every campaign is at cap
    spend.set(best.campaignId, spend.get(best.campaignId)! + STEP);
    remaining -= STEP;
  }

  const allocations: Allocation[] = curves
    .map((c) => {
      const s = spend.get(c.campaignId)!;
      const rev = revenueAt(c, s);
      return {
        campaignId: c.campaignId,
        name: c.name,
        platform: c.platform,
        currentDaily: c.currentDaily,
        plannedDaily: s,
        projRevenue: Math.round(rev),
        projProfit: Math.round(rev - s),
        projLeads: Math.round(rev * c.leadsPerRevenue),
        marginalRoas: marginalRoas(c, s),
      };
    })
    .sort((a, b) => b.projProfit - a.projProfit);

  const baselineRevenue = curves.reduce((sum, c) => sum + revenueAt(c, c.currentDaily), 0);
  const baselineSpend = curves.reduce((sum, c) => sum + c.currentDaily, 0);

  return {
    totalBudget,
    allocations,
    projRevenue: Math.round(allocations.reduce((s, x) => s + x.projRevenue, 0)),
    projProfit: Math.round(allocations.reduce((s, x) => s + x.projProfit, 0)),
    projLeads: allocations.reduce((s, x) => s + x.projLeads, 0),
    baseline: {
      spend: Math.round(baselineSpend),
      revenue: Math.round(baselineRevenue),
      profit: Math.round(baselineRevenue - baselineSpend),
    },
  };
}
