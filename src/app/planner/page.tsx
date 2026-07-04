import { getWorld } from "@/lib/data/world";
import { fitCurves } from "@/lib/planner/allocate";
import { Badge, PageHeader } from "@/components/ui";
import { LiveEmptyState } from "@/components/empty";
import { PlannerClient } from "./client";

export default async function PlannerPage() {
  const { campaigns, metrics, end, liveEmpty, mode } = await getWorld();

  if (liveEmpty) {
    return (
      <>
        <PageHeader title="Media Planner" actions={<Badge tone="neutral">live board</Badge>} />
        <LiveEmptyState>
          The planner fits response curves on your real campaign delivery. Connect an
          account to plan against live data, or switch to the Seeded demo board.
        </LiveEmptyState>
      </>
    );
  }

  const curves = fitCurves(campaigns, metrics, end);
  const currentTotal = curves.reduce((s, c) => s + c.currentDaily, 0);

  if (curves.length === 0) {
    return (
      <>
        <PageHeader title="Media Planner" actions={<Badge tone="live">live board</Badge>} />
        <LiveEmptyState title="Not enough delivery to fit curves yet">
          The planner needs a couple of weeks of spend on at least one campaign before it
          can fit response curves. Check back once your connected accounts have delivery.
        </LiveEmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Media Planner"
        subtitle="Each campaign gets a diminishing-returns curve fit on its last 14 days; the planner then allocates any total daily budget by marginal ROAS — dollars flow to whichever campaign returns the most for the NEXT dollar, within ±executable bounds."
        actions={
          <Badge tone={mode === "live" ? "live" : "demo"}>
            curves fit on 14d through {end}
          </Badge>
        }
      />
      <PlannerClient curves={curves} currentTotal={currentTotal} />
    </>
  );
}
