import { describe, expect, it } from "vitest";
import type { Campaign, DailyMetric } from "@/lib/adapters/types";
import { evaluateRule, type Rule } from "./rules";

const END = "2026-07-04";

function campaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: "c1",
    platform: "meta",
    name: "Test_Campaign",
    vertical: "health",
    status: "active",
    objective: "Leads",
    dailyBudget: 500,
    launchedAt: "2026-04-06",
    ...overrides,
  };
}

/** n days of identical delivery ending at END */
function days(
  n: number,
  perDay: Partial<DailyMetric>,
  campaignId = "c1",
  endDate = END,
): DailyMetric[] {
  const out: DailyMetric[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(`${endDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    out.push({
      date: d.toISOString().slice(0, 10),
      campaignId,
      spend: 200,
      revenue: 300,
      impressions: 20_000,
      clicks: 400,
      conversions: 10,
      ...perDay,
    });
  }
  return out;
}

const cpaRule: Rule = {
  id: "r1",
  name: "CPA guard",
  description: "",
  metric: "cpa",
  mode: "absolute",
  comparator: "gt",
  threshold: 30,
  windowDays: 3,
  minSpend: 100,
  platform: null,
  action: { type: "pause" },
};

describe("evaluateRule — absolute mode", () => {
  it("triggers when the window CPA breaches the threshold", () => {
    // 200 spend / 5 conversions = $40 CPA > $30
    const metrics = days(10, { conversions: 5 });
    const actions = evaluateRule(cpaRule, [campaign()], metrics, END);
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe("pause");
    expect(actions[0].evidence).toContain("CPA $40.00");
  });

  it("does not trigger when CPA is under the threshold", () => {
    // 200 / 10 = $20 CPA
    const actions = evaluateRule(cpaRule, [campaign()], days(10, {}), END);
    expect(actions).toHaveLength(0);
  });

  it("ignores paused campaigns and campaigns under min spend", () => {
    const metrics = days(10, { conversions: 5 });
    expect(
      evaluateRule(cpaRule, [campaign({ status: "paused" })], metrics, END),
    ).toHaveLength(0);
    expect(
      evaluateRule(
        { ...cpaRule, minSpend: 10_000 },
        [campaign()],
        metrics,
        END,
      ),
    ).toHaveLength(0);
  });

  it("respects a platform scope", () => {
    const metrics = days(10, { conversions: 5 });
    const scoped = { ...cpaRule, platform: "google" as const };
    expect(evaluateRule(scoped, [campaign()], metrics, END)).toHaveLength(0); // meta campaign
    expect(
      evaluateRule(scoped, [campaign({ platform: "google" })], metrics, END),
    ).toHaveLength(1);
  });

  it("only reads days inside the window", () => {
    // terrible CPA 10 days ago, clean CPA in the last 3 days
    const oldBad = days(7, { conversions: 1 }, "c1", "2026-06-27");
    const recentGood = days(3, { conversions: 20 });
    const actions = evaluateRule(
      cpaRule,
      [campaign()],
      [...oldBad, ...recentGood],
      END,
    );
    expect(actions).toHaveLength(0);
  });
});

describe("evaluateRule — change mode", () => {
  const fatigueRule: Rule = {
    id: "r2",
    name: "CTR decay",
    description: "",
    metric: "ctr",
    mode: "change",
    comparator: "lt",
    threshold: -0.2,
    windowDays: 5,
    minSpend: 100,
    platform: null,
    action: { type: "alert" },
  };

  it("triggers on a CTR drop vs the prior window", () => {
    const prior = days(5, { clicks: 400 }, "c1", "2026-06-29"); // ctr 2%
    const recent = days(5, { clicks: 200 }); // ctr 1% → -50%
    const actions = evaluateRule(fatigueRule, [campaign()], [...prior, ...recent], END);
    expect(actions).toHaveLength(1);
    expect(actions[0].evidence).toContain("-50%");
  });

  it("does not trigger on a small dip", () => {
    const prior = days(5, { clicks: 400 }, "c1", "2026-06-29");
    const recent = days(5, { clicks: 360 }); // -10%
    expect(
      evaluateRule(fatigueRule, [campaign()], [...prior, ...recent], END),
    ).toHaveLength(0);
  });

  it("skips campaigns with no prior-window data instead of dividing by zero", () => {
    const recent = days(5, {});
    expect(evaluateRule(fatigueRule, [campaign()], recent, END)).toHaveLength(0);
  });
});

describe("impact estimation", () => {
  it("pausing a money-loser reports a positive monthly saving", () => {
    // spend 200/day, revenue 100/day → profit -100/day → pausing saves ~3000/mo
    const metrics = days(10, { revenue: 100, conversions: 4 });
    const actions = evaluateRule(cpaRule, [campaign()], metrics, END);
    expect(actions[0].estMonthlyImpact).toBeGreaterThan(2500);
  });

  it("pausing a profitable campaign reports a negative impact (the HITL guard)", () => {
    // CPA breaches the rule but the campaign still profits → impact negative
    const metrics = days(10, { revenue: 400, conversions: 5 });
    const actions = evaluateRule(cpaRule, [campaign()], metrics, END);
    expect(actions).toHaveLength(1);
    expect(actions[0].estMonthlyImpact).toBeLessThan(0);
  });
});
