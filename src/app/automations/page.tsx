import { getWorld } from "@/lib/data/world";
import { evaluateAll, PRESET_RULES } from "@/lib/automations/rules";
import { Badge, PageHeader } from "@/components/ui";
import { AutomationsClient } from "./client";

export default async function AutomationsPage() {
  const { campaigns, metrics, end } = await getWorld();
  const pending = evaluateAll(PRESET_RULES, campaigns, metrics, end);

  return (
    <>
      <PageHeader
        title="Automation Studio"
        subtitle="Rules watch every campaign on a rolling window and queue actions with the evidence that triggered them. Nothing executes without human approval — the same draft-only guardrail a real ad account deserves."
        actions={<Badge tone="demo">evaluated {end}</Badge>}
      />
      <AutomationsClient rules={PRESET_RULES} initialPending={pending} />
    </>
  );
}
