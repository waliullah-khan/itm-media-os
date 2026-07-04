"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { allocate, type CampaignCurve } from "@/lib/planner/allocate";
import { PLATFORM_LABELS } from "@/lib/adapters/types";
import { Card, PlatformDot, Scorecard, StatTile } from "@/components/ui";
import { fmtRoas, fmtUsd, fmtUsdCompact, fmtNumCompact, delta } from "@/lib/format";

export function PlannerClient({
  curves,
  currentTotal,
}: {
  curves: CampaignCurve[];
  currentTotal: number;
}) {
  const [budget, setBudget] = useState(currentTotal);
  const plan = useMemo(() => allocate(curves, budget), [curves, budget]);

  const min = Math.round((currentTotal * 0.5) / 100) * 100;
  const max = Math.round((currentTotal * 2) / 100) * 100;

  return (
    <>
      {/* Budget slider */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <label htmlFor="budget" className="text-[13px] font-medium">
            Total daily budget
          </label>
          <input
            id="budget"
            type="range"
            min={min}
            max={max}
            step={100}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="h-2 min-w-56 flex-1 cursor-pointer accent-[--color-primary]"
          />
          <div className="tnum w-28 text-right text-lg font-semibold">
            {fmtUsd(budget)}
            <span className="text-[12px] font-normal text-ink-faint">/day</span>
          </div>
          <button
            onClick={() => setBudget(currentTotal)}
            className="min-h-8 cursor-pointer rounded-md border border-line bg-surface-2 px-2.5 text-[12px] text-ink-muted hover:text-ink"
          >
            Reset to current ({fmtUsd(currentTotal)})
          </button>
        </div>
      </Card>

      {/* Projections */}
      <Scorecard className="mb-4 lg:grid-cols-4">
        <StatTile
          label="Projected daily revenue"
          value={fmtUsdCompact(plan.projRevenue)}
          deltaValue={delta(plan.projRevenue, plan.baseline.revenue)}
          hint={`vs ${fmtUsdCompact(plan.baseline.revenue)} at current allocation`}
        />
        <StatTile
          label="Projected daily profit"
          value={fmtUsdCompact(plan.projProfit)}
          deltaValue={delta(plan.projProfit, plan.baseline.profit)}
          hint={`vs ${fmtUsdCompact(plan.baseline.profit)} today`}
        />
        <StatTile
          label="Projected daily leads"
          value={fmtNumCompact(plan.projLeads)}
        />
        <StatTile
          label="Blended ROAS at plan"
          value={fmtRoas(plan.projRevenue / Math.max(plan.totalBudget, 1))}
          hint="diminishing returns priced in"
        />
      </Scorecard>

      {/* Allocation table */}
      <Card title="Recommended allocation — dollars follow marginal ROAS">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="pb-2 font-medium">Campaign</th>
                <th className="pb-2 text-right font-medium">Current $/day</th>
                <th className="pb-2 text-right font-medium">Planned $/day</th>
                <th className="pb-2 text-right font-medium">Change</th>
                <th className="pb-2 text-right font-medium">Proj. profit/day</th>
                <th className="pb-2 text-right font-medium">Marginal ROAS</th>
                <th className="pb-2 pl-6 font-medium">Shift</th>
              </tr>
            </thead>
            <tbody>
              {plan.allocations.map((a) => {
                const change = a.plannedDaily - a.currentDaily;
                const maxShift = Math.max(
                  ...plan.allocations.map((x) => Math.abs(x.plannedDaily - x.currentDaily)),
                  1,
                );
                return (
                  <tr key={a.campaignId} className="border-t border-line">
                    <td className="py-2.5 pr-3">
                      <Link
                        href={`/campaigns/${a.campaignId}`}
                        className="flex items-center gap-2 font-medium hover:underline"
                      >
                        <PlatformDot platform={a.platform} />
                        <span className="max-w-64 truncate">{a.name}</span>
                      </Link>
                      <span className="ml-4 text-[11px] text-ink-faint">
                        {PLATFORM_LABELS[a.platform]}
                      </span>
                    </td>
                    <td className="tnum py-2.5 text-right text-ink-muted">
                      {fmtUsd(a.currentDaily)}
                    </td>
                    <td className="tnum py-2.5 text-right font-medium">
                      {fmtUsd(a.plannedDaily)}
                    </td>
                    <td
                      className={`tnum py-2.5 text-right font-medium ${
                        change > 0 ? "text-pos" : change < 0 ? "text-neg" : "text-ink-faint"
                      }`}
                    >
                      {change === 0 ? "—" : `${change > 0 ? "+" : ""}${fmtUsd(change)}`}
                    </td>
                    <td
                      className={`tnum py-2.5 text-right ${
                        a.projProfit >= 0 ? "text-pos" : "text-neg"
                      }`}
                    >
                      {fmtUsd(a.projProfit)}
                    </td>
                    <td className="tnum py-2.5 text-right text-ink-muted">
                      {fmtRoas(a.marginalRoas)}
                    </td>
                    <td className="py-2.5 pl-6">
                      <div className="flex h-1.5 w-32 items-center">
                        <div className="relative h-1.5 w-full rounded-full bg-surface-2">
                          <div
                            className={`absolute top-0 h-1.5 rounded-full ${
                              change >= 0 ? "left-1/2 bg-pos" : "right-1/2 bg-neg"
                            }`}
                            style={{
                              width: `${(Math.abs(change) / maxShift) * 50}%`,
                            }}
                          />
                          <div className="absolute left-1/2 top-[-2px] h-2.5 w-px bg-line" />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
          Model: revenue(s) = a·s^0.85 per campaign, calibrated on trailing-14d delivery; allocation is greedy
          by marginal ROAS in $25 steps, bounded to 30-250% of current spend so the plan survives contact with
          real platform pacing. The curves live in{" "}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-[11px]">src/lib/planner/allocate.ts</code>.
        </p>
      </Card>
    </>
  );
}
