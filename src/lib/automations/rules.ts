/**
 * Automation rules engine.
 *
 * Rules are declarative conditions over a rolling window of campaign
 * performance. Evaluation NEVER executes anything: it produces pending
 * actions with the evidence that triggered them, and a human approves or
 * rejects each one. Approved actions would be pushed to the platform APIs
 * through the same adapter layer the dashboards read from.
 */

import type { Campaign, DailyMetric, Platform } from "@/lib/adapters/types";
import {
  groupBy,
  inRange,
  shiftDate,
  sumMetrics,
  windowPair,
  type Totals,
} from "@/lib/data/aggregate";

export type RuleMetric = "cpa" | "roas" | "ctr" | "cvr" | "spend";
export type Comparator = "gt" | "lt";
export type ActionType = "pause" | "scale_up" | "scale_down" | "alert";

export interface Rule {
  id: string;
  name: string;
  description: string;
  /** metric measured over the window; "change" rules compare to prior window */
  metric: RuleMetric;
  mode: "absolute" | "change";
  comparator: Comparator;
  /** absolute value for mode=absolute; relative change (e.g. -0.25) for mode=change */
  threshold: number;
  windowDays: number;
  /** ignore campaigns that spent less than this in the window (noise guard) */
  minSpend: number;
  /** limit rule to one platform, or null for all */
  platform: Platform | null;
  action: { type: ActionType; amountPct?: number };
}

export interface PendingAction {
  ruleId: string;
  ruleName: string;
  campaignId: string;
  campaignName: string;
  platform: Platform;
  action: ActionType;
  amountPct?: number;
  /** human-readable evidence, e.g. "CPA $61.42 > $45 over 3d ($1,842 spend)" */
  evidence: string;
  /** estimated monthly $ impact of taking the action */
  estMonthlyImpact: number;
}

export const PRESET_RULES: Rule[] = [
  {
    id: "kill-cpa",
    name: "Kill runaway CPA",
    description: "Pause any campaign whose CPA runs above $70 across 4 days of meaningful spend.",
    metric: "cpa",
    mode: "absolute",
    comparator: "gt",
    threshold: 70,
    windowDays: 4,
    minSpend: 400,
    platform: null,
    action: { type: "pause" },
  },
  {
    id: "scale-winners",
    name: "Scale proven winners",
    description: "Raise budget +20% when a campaign holds ROAS above 2.0 for a full week.",
    metric: "roas",
    mode: "absolute",
    comparator: "gt",
    threshold: 2.0,
    windowDays: 7,
    minSpend: 700,
    platform: null,
    action: { type: "scale_up", amountPct: 20 },
  },
  {
    id: "fatigue-alert",
    name: "Creative fatigue alert",
    description: "Flag campaigns whose CTR fell more than 20% vs the prior 3 weeks.",
    metric: "ctr",
    mode: "change",
    comparator: "lt",
    threshold: -0.2,
    windowDays: 21,
    minSpend: 1000,
    platform: null,
    action: { type: "alert" },
  },
  {
    id: "trim-losers",
    name: "Trim negative margin",
    description: "Cut budget -25% when a week of spend returns less than 0.9x.",
    metric: "roas",
    mode: "absolute",
    comparator: "lt",
    threshold: 0.9,
    windowDays: 7,
    minSpend: 700,
    platform: null,
    action: { type: "scale_down", amountPct: 25 },
  },
  {
    id: "meta-cpc-watch",
    name: "Meta efficiency watch",
    description: "Alert when a Meta campaign's CVR drops below 2% over 5 days (lead quality / pixel issues).",
    metric: "cvr",
    mode: "absolute",
    comparator: "lt",
    threshold: 0.02,
    windowDays: 5,
    minSpend: 500,
    platform: "meta",
    action: { type: "alert" },
  },
];

function metricValue(t: Totals, metric: RuleMetric): number {
  switch (metric) {
    case "cpa":
      return t.cpa;
    case "roas":
      return t.roas;
    case "ctr":
      return t.ctr;
    case "cvr":
      return t.cvr;
    case "spend":
      return t.spend;
  }
}

function fmtMetric(metric: RuleMetric, v: number): string {
  if (!isFinite(v)) return "∞";
  switch (metric) {
    case "cpa":
      return `$${v.toFixed(2)}`;
    case "roas":
      return `${v.toFixed(2)}x`;
    case "ctr":
    case "cvr":
      return `${(v * 100).toFixed(2)}%`;
    case "spend":
      return `$${Math.round(v)}`;
  }
}

/**
 * Estimated monthly $ impact of the proposed action, from the window's run-rate:
 * pausing a loser saves its negative profit; scaling a winner adds
 * proportional profit; alerts carry the at-risk profit delta.
 */
function estimateImpact(t: Totals, windowDays: number, action: ActionType, amountPct = 0): number {
  const dailyProfit = t.profit / windowDays;
  switch (action) {
    case "pause":
      return Math.round(-dailyProfit * 30); // stopping a negative-profit campaign saves this
    case "scale_up":
      return Math.round(dailyProfit * (amountPct / 100) * 30);
    case "scale_down":
      return Math.round(-dailyProfit * (amountPct / 100) * 30);
    case "alert":
      return Math.round(Math.abs(dailyProfit) * 30 * 0.25); // rough at-risk share
  }
}

export function evaluateRule(
  rule: Rule,
  campaigns: Campaign[],
  metrics: DailyMetric[],
  end: string,
): PendingAction[] {
  const actions: PendingAction[] = [];
  const byCampaign = groupBy(metrics, (r) => r.campaignId);

  for (const c of campaigns) {
    if (c.status !== "active") continue;
    if (rule.platform && c.platform !== rule.platform) continue;

    const rows = byCampaign[c.id];
    if (!rows) continue;

    const window = { from: shiftDate(end, -(rule.windowDays - 1)), to: end };
    const cur = sumMetrics(inRange(rows, window));
    if (cur.spend < rule.minSpend) continue;

    let value: number;
    let evidence: string;

    if (rule.mode === "absolute") {
      value = metricValue(cur, rule.metric);
      evidence = `${rule.metric.toUpperCase()} ${fmtMetric(rule.metric, value)} ${
        rule.comparator === "gt" ? ">" : "<"
      } ${fmtMetric(rule.metric, rule.threshold)} over ${rule.windowDays}d ($${Math.round(cur.spend)} spend)`;
    } else {
      const { previous } = windowPair(end, rule.windowDays);
      const prev = sumMetrics(inRange(rows, previous));
      const prevValue = metricValue(prev, rule.metric);
      if (prevValue === 0 || !isFinite(prevValue)) continue;
      value = (metricValue(cur, rule.metric) - prevValue) / prevValue;
      evidence = `${rule.metric.toUpperCase()} ${value >= 0 ? "+" : ""}${(value * 100).toFixed(
        0,
      )}% vs prior ${rule.windowDays}d (${fmtMetric(rule.metric, prevValue)} → ${fmtMetric(
        rule.metric,
        metricValue(cur, rule.metric),
      )})`;
    }

    const triggered =
      rule.comparator === "gt" ? value > rule.threshold : value < rule.threshold;
    if (!triggered) continue;

    actions.push({
      ruleId: rule.id,
      ruleName: rule.name,
      campaignId: c.id,
      campaignName: c.name,
      platform: c.platform,
      action: rule.action.type,
      amountPct: rule.action.amountPct,
      evidence,
      estMonthlyImpact: estimateImpact(cur, rule.windowDays, rule.action.type, rule.action.amountPct),
    });
  }

  return actions;
}

export function evaluateAll(
  rules: Rule[],
  campaigns: Campaign[],
  metrics: DailyMetric[],
  end: string,
): PendingAction[] {
  return rules.flatMap((r) => evaluateRule(r, campaigns, metrics, end));
}
