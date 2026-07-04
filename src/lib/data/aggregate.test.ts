import { describe, expect, it } from "vitest";
import type { DailyMetric } from "@/lib/adapters/types";
import {
  dailySeries,
  inRange,
  scorecard,
  shiftDate,
  sumMetrics,
  windowPair,
} from "./aggregate";

function row(overrides: Partial<DailyMetric>): DailyMetric {
  return {
    date: "2026-07-01",
    campaignId: "c1",
    spend: 100,
    revenue: 150,
    impressions: 10_000,
    clicks: 200,
    conversions: 10,
    ...overrides,
  };
}

describe("sumMetrics", () => {
  it("derives rates and unit economics from summed rows", () => {
    const t = sumMetrics([
      row({}),
      row({ date: "2026-07-02", spend: 300, revenue: 250, clicks: 400, conversions: 30, impressions: 30_000 }),
    ]);
    expect(t.spend).toBe(400);
    expect(t.revenue).toBe(400);
    expect(t.profit).toBe(0);
    expect(t.ctr).toBeCloseTo(600 / 40_000);
    expect(t.cvr).toBeCloseTo(40 / 600);
    expect(t.cpc).toBeCloseTo(400 / 600);
    expect(t.cpa).toBeCloseTo(10);
    expect(t.epc).toBeCloseTo(400 / 600);
    expect(t.roas).toBe(1);
  });

  it("handles empty input and zero denominators without NaN", () => {
    const t = sumMetrics([]);
    expect(t.ctr).toBe(0);
    expect(t.roas).toBe(0);
    expect(t.cpa).toBe(Infinity); // no conversions = infinitely expensive
  });
});

describe("date windows", () => {
  it("shiftDate crosses month boundaries", () => {
    expect(shiftDate("2026-07-01", -1)).toBe("2026-06-30");
    expect(shiftDate("2026-06-30", 1)).toBe("2026-07-01");
  });

  it("windowPair produces adjacent, non-overlapping windows of equal length", () => {
    const { current, previous } = windowPair("2026-07-04", 30);
    expect(current).toEqual({ from: "2026-06-05", to: "2026-07-04" });
    expect(previous).toEqual({ from: "2026-05-06", to: "2026-06-04" });
    // adjacency: previous ends the day before current starts
    expect(shiftDate(previous.to, 1)).toBe(current.from);
  });

  it("inRange is inclusive on both endpoints", () => {
    const rows = [
      row({ date: "2026-06-30" }),
      row({ date: "2026-07-01" }),
      row({ date: "2026-07-02" }),
    ];
    const got = inRange(rows, { from: "2026-06-30", to: "2026-07-01" });
    expect(got.map((r) => r.date)).toEqual(["2026-06-30", "2026-07-01"]);
  });
});

describe("scorecard", () => {
  it("splits current vs previous period correctly", () => {
    const rows = [
      row({ date: "2026-07-04", spend: 100 }), // current 2d window
      row({ date: "2026-07-03", spend: 100 }),
      row({ date: "2026-07-02", spend: 50 }), // previous 2d window
      row({ date: "2026-07-01", spend: 50 }),
    ];
    const sc = scorecard(rows, "2026-07-04", 2);
    expect(sc.current.spend).toBe(200);
    expect(sc.previous.spend).toBe(100);
  });
});

describe("dailySeries", () => {
  it("sums across campaigns per day and sorts ascending", () => {
    const rows = [
      row({ date: "2026-07-02", campaignId: "a", spend: 10, revenue: 30 }),
      row({ date: "2026-07-01", campaignId: "a", spend: 10, revenue: 20 }),
      row({ date: "2026-07-01", campaignId: "b", spend: 5, revenue: 5 }),
    ];
    const series = dailySeries(rows);
    expect(series.map((p) => p.date)).toEqual(["2026-07-01", "2026-07-02"]);
    expect(series[0].spend).toBe(15);
    expect(series[0].revenue).toBe(25);
    expect(series[0].profit).toBe(10);
  });
});
