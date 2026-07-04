import { getWorld } from "@/lib/data/world";
import { fitCurves } from "@/lib/planner/allocate";
import { Badge, PageHeader } from "@/components/ui";
import { PlannerClient } from "./client";

export default async function PlannerPage() {
  const { campaigns, metrics, end } = await getWorld();
  const curves = fitCurves(campaigns, metrics, end);
  const currentTotal = curves.reduce((s, c) => s + c.currentDaily, 0);

  return (
    <>
      <PageHeader
        title="Media Planner"
        subtitle="Each campaign gets a diminishing-returns curve fit on its last 14 days; the planner then allocates any total daily budget by marginal ROAS — dollars flow to whichever campaign returns the most for the NEXT dollar, within ±executable bounds."
        actions={<Badge tone="demo">curves fit on 14d through {end}</Badge>}
      />
      <PlannerClient curves={curves} currentTotal={currentTotal} />
    </>
  );
}
