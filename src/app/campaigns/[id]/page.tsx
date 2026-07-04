import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorld, getCampaignAds } from "@/lib/data/world";
import {
  dailySeries,
  detectAnomalies,
  scorecard,
} from "@/lib/data/aggregate";
import { PLATFORM_LABELS, VERTICAL_LABELS } from "@/lib/adapters/types";
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
import {
  delta,
  fmtNumCompact,
  fmtPct,
  fmtRoas,
  fmtUsd,
  fmtUsdCompact,
} from "@/lib/format";

export default async function CampaignDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { campaigns, metrics, end } = await getWorld();
  const campaign = campaigns.find((c) => c.id === id);
  if (!campaign) notFound();

  const mine = metrics.filter((m) => m.campaignId === id);
  const sc = scorecard(mine, end, 30);
  const cur = sc.current;
  const prev = sc.previous;
  const series = dailySeries(mine);
  const ads = (await getCampaignAds(campaign)).sort((a, b) => b.spend - a.spend);
  const anomalies = detectAnomalies(mine, [campaign], end);

  return (
    <>
      <div className="mb-1 text-[12px]">
        <Link href="/campaigns" className="text-ink-muted hover:text-ink">
          ← Campaigns
        </Link>
      </div>
      <PageHeader
        title={campaign.name}
        subtitle={`${PLATFORM_LABELS[campaign.platform]} · ${VERTICAL_LABELS[campaign.vertical]} · ${campaign.objective} · $${campaign.dailyBudget}/day budget · launched ${campaign.launchedAt}`}
        actions={
          <span className="flex items-center gap-2">
            <PlatformDot platform={campaign.platform} />
            <Badge tone={campaign.status === "active" ? "pos" : "neutral"}>
              {campaign.status}
            </Badge>
          </span>
        }
      />

      {anomalies.length > 0 && (
        <div className="mb-4 space-y-2">
          {anomalies.map((a) => (
            <div
              key={a.kind}
              className="flex gap-2.5 rounded-lg border border-warn/30 bg-warn/5 p-3"
            >
              <IconAlert
                size={16}
                className={`mt-0.5 shrink-0 ${
                  a.severity === "critical" ? "text-neg" : "text-warn"
                }`}
              />
              <div>
                <span className="text-[13px] font-medium">{a.title}</span>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">
                  {a.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Scorecard className="lg:grid-cols-6">
        <StatTile
          label="Spend (30d)"
          value={fmtUsdCompact(cur.spend)}
          deltaValue={delta(cur.spend, prev.spend)}
          goodWhenUp={false}
        />
        <StatTile
          label="Profit (30d)"
          value={fmtUsdCompact(cur.profit)}
          deltaValue={delta(cur.profit, prev.profit)}
        />
        <StatTile
          label="ROAS"
          value={fmtRoas(cur.roas)}
          deltaValue={delta(cur.roas, prev.roas)}
        />
        <StatTile
          label="CPA"
          value={isFinite(cur.cpa) ? fmtUsd(cur.cpa, true) : "–"}
          deltaValue={
            isFinite(cur.cpa) && isFinite(prev.cpa)
              ? delta(cur.cpa, prev.cpa)
              : null
          }
          goodWhenUp={false}
        />
        <StatTile
          label="CTR"
          value={fmtPct(cur.ctr, 2)}
          deltaValue={delta(cur.ctr, prev.ctr)}
        />
        <StatTile
          label="CVR"
          value={fmtPct(cur.cvr, 1)}
          deltaValue={delta(cur.cvr, prev.cvr)}
        />
      </Scorecard>

      <Card title="Spend vs revenue — 90 days" className="mt-4">
        <TrendChart data={series} />
      </Card>

      {/* Ads — full-width ruled ledger, no card box */}
      <section className="mt-8">
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.09em] text-ink-faint">
          Ads — dataset lifetime
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="border-b border-line-strong text-left text-[10.5px] uppercase tracking-[0.07em] text-ink-faint">
                <th className="pb-2 pr-3 font-medium">Ad</th>
                <th className="pb-2 pr-3 font-medium">Format</th>
                <th className="pb-2 pr-3 font-medium">Hook</th>
                <th className="pb-2 text-right font-medium">Spend</th>
                <th className="pb-2 text-right font-medium">Leads</th>
                <th className="pb-2 text-right font-medium">CTR</th>
                <th className="pb-2 text-right font-medium">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {ads.map((ad) => {
                const ctr = ad.impressions > 0 ? ad.clicks / ad.impressions : 0;
                const roas = ad.spend > 0 ? ad.revenue / ad.spend : 0;
                return (
                  <tr key={ad.id} className="border-b border-line">
                    <td className="py-2.5 pr-3">
                      <div className="font-medium">{ad.name}</div>
                      <div className="text-[12px] text-ink-faint">
                        {ad.headline}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge tone="neutral">{ad.format}</Badge>
                    </td>
                    <td className="max-w-64 py-2.5 pr-3 text-[12px] text-ink-muted">
                      {ad.hook}
                    </td>
                    <td className="tnum py-2.5 text-right font-mono">
                      {fmtUsd(ad.spend)}
                    </td>
                    <td className="tnum py-2.5 text-right font-mono">
                      {fmtNumCompact(ad.conversions)}
                    </td>
                    <td className="tnum py-2.5 text-right font-mono">
                      {fmtPct(ctr, 2)}
                    </td>
                    <td
                      className={`tnum py-2.5 text-right font-mono font-medium ${
                        roas >= 1 ? "text-pos" : "text-neg"
                      }`}
                    >
                      {fmtRoas(roas)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
