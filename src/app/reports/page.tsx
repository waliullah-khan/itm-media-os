import { REPORT_TEMPLATES } from "@/lib/reports/templates";
import { PageHeader } from "@/components/ui";
import { ReportsClient } from "./client";

export default function ReportsPage() {
  // strip the system prompts before shipping to the client bundle
  const templates = REPORT_TEMPLATES.map(({ id, name, source, sourceSkill, description, platform }) => ({
    id,
    name,
    source,
    sourceSkill,
    description,
    platform: platform ?? null,
  }));

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="The skill library from two production Claude Code workspaces — an agency growth system and an ecommerce CRO system — ported into the product as one-click reports. Each runs its source skill's analytical structure against this account's data (seeded or your connected accounts) and streams back a working document, not chatbot output."
      />
      <ReportsClient templates={templates} />
    </>
  );
}
