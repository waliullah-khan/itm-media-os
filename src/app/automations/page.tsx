import { getWorld } from "@/lib/data/world";
import { evaluateAll, PRESET_RULES } from "@/lib/automations/rules";
import { Badge, PageHeader } from "@/components/ui";
import { LiveEmptyState } from "@/components/empty";
import { AutomationsClient } from "./client";

export default async function AutomationsPage() {
  const { campaigns, metrics, end, liveEmpty, mode } = await getWorld();

  if (liveEmpty) {
    return (
      <>
        <PageHeader title="Automation Studio" actions={<Badge tone="neutral">live board</Badge>} />
        <LiveEmptyState>
          Rules evaluate against your real campaign delivery. Connect an account to run
          automations on live data, or switch to the Seeded demo board.
        </LiveEmptyState>
      </>
    );
  }

  const pending = evaluateAll(PRESET_RULES, campaigns, metrics, end);

  return (
    <>
      <PageHeader
        title="Automation Studio"
        subtitle="Rules watch every campaign on a rolling window and queue actions with the evidence that triggered them. Nothing executes without human approval — the same draft-only guardrail a real ad account deserves."
        actions={
          <Badge tone={mode === "live" ? "live" : "demo"}>evaluated {end}</Badge>
        }
      />
      <AutomationsClient rules={PRESET_RULES} initialPending={pending} />
    </>
  );
}
