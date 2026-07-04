import Link from "next/link";
import { getWorld } from "@/lib/data/world";
import {
  byCampaign,
  byPlatform,
  dailySeries,
  detectAnomalies,
  inRange,
  scorecard,
  windowPair,
} from "@/lib/data/aggregate";
import { PLATFORM_LABELS, type Platform } from "@/lib/adapters/types";
import { TrendChart } from "@/components/charts";
import {
  Badge,
  Card,
  PageHeader,
  PlatformDot,
  Scorecard,
  StatTile,
} from "@/components/ui";
import { IconAlert } from "@/components/icons";
import { LiveEmptyState } from "@/components/empty";
import {
  delta,
  fmtNumCompact,
  fmtRoas,
  fmtUsd,
  fmtUsdCompact,
} from "@/lib/format";

export default async function CommandCenter() {
  const world = await getWorld();
  const { campaigns, metrics, end, livePlatforms, liveEmpty } = world;

  if (liveEmpty) {
    return (
      <>
        <PageHeader
          title="Command Center"
          subtitle="Cross-platform view of all paid delivery."
          actions={<Badge tone="neutral">live board</Badge>}
        />
        <LiveEmptyState />
      </>
    );
  }

  const sc = scorecard(metrics, end, 30);
  const cur = sc.current;
  const prev = sc.previous;

  const rows30 = inRange(metrics, windowPair(end, 30).current);
  const platforms = byPlatform(rows30, campaigns);
  const campaignRollup = byCampaign(rows30);
  const campaignById = new Map(campaigns.map((c) => [c.id, c]));
  const anomalies = detectAnomalies(metrics, campaigns, end);
  const series = dailySeries(metrics);

  const top5 = campaignRollup.slice(0, 5);
  const bottom5 = campaignRollup.slice(-5).reverse();

  const severityTone = { critical: "neg", warn: "warn", info: "demo" } as const;

  return (
    <>
      <PageHeader
        title="Command Center"
        subtitle={`Cross-platform view of all paid delivery. Last 30 days vs the 30 before, data through ${end}.`}
        actions={
          livePlatforms.length > 0 ? (
            <Badge tone="live">
              live · {livePlatforms.map((p) => PLATFORM_LABELS[p]).join(", ")}
            </Badge>
          ) : (
            <Badge tone="demo">seeded demo</Badge>
          )
        }
      />

      {/* Scorecards */}
      <Scorecard className="lg:grid-cols-6">
        <StatTile
          label="Spend"
          value={fmtUsdCompact(cur.spend)}
          deltaValue={delta(cur.spend, prev.spend)}
          goodWhenUp={false}
        />
        <StatTile
          label="Revenue"
          value={fmtUsdCompact(cur.revenue)}
          deltaValue={delta(cur.revenue, prev.revenue)}
        />
        <StatTile
          label="Profit"
          value={fmtUsdCompact(cur.profit)}
          deltaValue={delta(cur.profit, prev.profit)}
        />
        <StatTile
          label="Blended ROAS"
          value={fmtRoas(cur.roas)}
          deltaValue={delta(cur.roas, prev.roas)}
        />
        <StatTile
          label="Leads"
          value={fmtNumCompact(cur.conversions)}
          deltaValue={delta(cur.conversions, prev.conversions)}
        />
        <StatTile
          label="Blended CPA"
          value={fmtUsd(cur.cpa, true)}
          deltaValue={delta(cur.cpa, prev.cpa)}
          goodWhenUp={false}
        />
      </Scorecard>

      {/* Trend + anomalies */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Spend vs revenue — 90 days" className="lg:col-span-2">
          <TrendChart data={series} />
        </Card>

        <Card title="Signals" className="lg:col-span-1">
          <ul className="space-y-2.5">
            {anomalies.map((a) => (
              <li key={`${a.kind}-${a.campaignId}`}>
                <Link
                  href={`/campaigns/${a.campaignId}`}
                  className="group flex gap-2.5 rounded-md border border-line bg-surface-2/40 p-2.5 transition-colors hover:border-primary/40"
                >
                  <IconAlert
                    size={15}
                    className={`mt-0.5 shrink-0 ${
                      a.severity === "critical"
                        ? "text-neg"
                        : a.severity === "warn"
                          ? "text-warn"
                          : "text-primary"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[13px] font-medium">{a.title}</span>
                      <Badge tone={severityTone[a.severity]}>{a.evidence}</Badge>
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-ink-muted">
                      {campaignById.get(a.campaignId)?.name}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Platform breakdown — full-width ruled ledger, no card box */}
      <section className="mt-8">
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.09em] text-ink-faint">
          Platform breakdown — last 30 days
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-line-strong text-left text-[10.5px] uppercase tracking-[0.07em] text-ink-faint">
                <th className="pb-2 pr-3 font-medium">Platform</th>
                <th className="pb-2 text-right font-medium">Spend</th>
                <th className="pb-2 text-right font-medium">Revenue</th>
                <th className="pb-2 text-right font-medium">Profit</th>
                <th className="pb-2 text-right font-medium">ROAS</th>
                <th className="pb-2 text-right font-medium">Leads</th>
                <th className="pb-2 text-right font-medium">CPA</th>
                <th className="pb-2 pl-6 font-medium">Share of spend</th>
              </tr>
            </thead>
            <tbody>
              {platforms.map(({ platform, totals }) => (
                <tr key={platform} className="border-b border-line">
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-2 font-medium">
                      <PlatformDot platform={platform} />
                      {PLATFORM_LABELS[platform as Platform]}
                    </span>
                  </td>
                  <td className="tnum py-2.5 text-right font-mono">
                    {fmtUsd(totals.spend)}
                  </td>
                  <td className="tnum py-2.5 text-right font-mono">
                    {fmtUsd(totals.revenue)}
                  </td>
                  <td
                    className={`tnum py-2.5 text-right font-mono font-medium ${
                      totals.profit >= 0 ? "text-pos" : "text-neg"
                    }`}
                  >
                    {fmtUsd(totals.profit)}
                  </td>
                  <td className="tnum py-2.5 text-right font-mono">
                    {fmtRoas(totals.roas)}
                  </td>
                  <td className="tnum py-2.5 text-right font-mono">
                    {fmtNumCompact(totals.conversions)}
                  </td>
                  <td className="tnum py-2.5 text-right font-mono">
                    {fmtUsd(totals.cpa, true)}
                  </td>
                  <td className="py-2.5 pl-6">
                    <div className="h-1 w-full max-w-40 rounded-[1px] bg-surface-2">
                      <div
                        className="h-1 rounded-[1px]"
                        style={{
                          width: `${(totals.spend / cur.spend) * 100}%`,
                          background: "var(--color-primary)",
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top / bottom campaigns */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {[
          { title: "Top campaigns by profit — 30d", rows: top5 },
          { title: "Bottom campaigns by profit — 30d", rows: bottom5 },
        ].map(({ title, rows }) => (
          <Card key={title} title={title}>
            <ul className="divide-y divide-line">
              {rows.map(({ campaignId, totals }) => {
                const c = campaignById.get(campaignId);
                if (!c) return null;
                return (
                  <li key={campaignId}>
                    <Link
                      href={`/campaigns/${campaignId}`}
                      className="flex items-center gap-3 py-2 transition-colors hover:bg-surface-2/40"
                    >
                      <PlatformDot platform={c.platform} />
                      <span className="min-w-0 flex-1 truncate text-[13px]">
                        {c.name}
                      </span>
                      <span className="tnum text-[12px] text-ink-muted">
                        {fmtRoas(totals.roas)}
                      </span>
                      <span
                        className={`tnum w-20 text-right text-[13px] font-medium ${
                          totals.profit >= 0 ? "text-pos" : "text-neg"
                        }`}
                      >
                        {fmtUsdCompact(totals.profit)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
