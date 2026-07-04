import { getWorld } from "@/lib/data/world";
import {
  byCampaign,
  inRange,
  windowPair,
} from "@/lib/data/aggregate";
import { Badge, PageHeader } from "@/components/ui";
import { CampaignTable, type CampaignRow } from "./table";

export default async function CampaignsPage() {
  const { campaigns, metrics, end } = await getWorld();
  const rows30 = inRange(metrics, windowPair(end, 30).current);
  const rollup = new Map(
    byCampaign(rows30).map((r) => [r.campaignId, r.totals]),
  );

  const rows: CampaignRow[] = campaigns.map((c) => {
    const t = rollup.get(c.id);
    return {
      id: c.id,
      name: c.name,
      platform: c.platform,
      vertical: c.vertical,
      status: c.status,
      spend: t?.spend ?? 0,
      revenue: t?.revenue ?? 0,
      profit: t?.profit ?? 0,
      roas: t?.roas ?? 0,
      conversions: t?.conversions ?? 0,
      cpa: t && isFinite(t.cpa) ? t.cpa : null,
    };
  });

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="Every campaign across all four platforms — last 30 days. Click a row to drill in."
        actions={<Badge tone="demo">demo dataset</Badge>}
      />
      <CampaignTable rows={rows} />
    </>
  );
}
