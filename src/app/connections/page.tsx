import { PLATFORM_LABELS, PLATFORMS } from "@/lib/adapters/types";
import { getConnections } from "@/lib/connections/store";
import { Badge, Card, PageHeader, PlatformDot } from "@/components/ui";
import { MetaConnect } from "./meta-connect";

/** Badges must reflect the runtime environment, not build-time env capture. */
export const dynamic = "force-dynamic";

/** What a live integration for each platform requires. Meta is connectable
 * today (simple token auth); the others need provisioned OAuth apps or
 * developer tokens, so their adapters are the documented next step. */
const PLATFORM_NOTES: Record<string, { note: string; connect: "live" | "planned" }> = {
  google: {
    note: "Needs a Google Ads API developer token + OAuth2 app approval. GAQL queries slot into the adapter's getDailyMetrics/getCampaigns.",
    connect: "planned",
  },
  meta: {
    note: "Marketing API with token auth — connect a real ad account below and every module reads its actual last-90-day delivery through the live adapter.",
    connect: "live",
  },
  taboola: {
    note: "Backstage API client-credentials pair (issued by your account manager). Campaign-summary reports map onto the same DailyMetric shape.",
    connect: "planned",
  },
  tiktok: {
    note: "Marketing API app + access token. The reporting endpoint's daily metrics normalize into the adapter in ~50 lines.",
    connect: "planned",
  },
};

const SERVICES = [
  {
    name: "Anthropic (Claude)",
    envVar: "ANTHROPIC_API_KEY",
    role: "AI Analyst weekly reviews · creative analysis + reproduction prompts in Ad Intelligence",
  },
  {
    name: "Apify",
    envVar: "APIFY_TOKEN",
    role: "Meta Ad Library scraping — the same actor the team's n8n workflow used, now called natively",
  },
  {
    name: "Firecrawl",
    envVar: "FIRECRAWL_API_KEY",
    role: "Competitor landing-page scraping for funnel notes in Ad Intelligence",
  },
  {
    name: "Vercel Cron",
    envVar: "CRON_SECRET",
    role: "Weekly scheduled ad-library refresh (/api/cron/refresh-intel) — replaces the n8n schedule trigger",
  },
];

export default async function ConnectionsPage() {
  const connections = await getConnections();

  return (
    <>
      <PageHeader
        title="Connections"
        subtitle="Every ad platform is served through one PlatformAdapter interface. Platforms run on seeded demo data until you connect a real account — connecting swaps in a live API adapter and changes zero lines of dashboard, analyst, automation, or planner code."
      />

      <h2 className="mb-3 text-[13px] font-medium text-ink-muted">Ad platforms — adapter layer</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {PLATFORMS.map((p) => {
          const cfg = PLATFORM_NOTES[p];
          const metaConnected = p === "meta" && connections.meta;
          return (
            <Card key={p}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[14px] font-semibold">
                  <PlatformDot platform={p} />
                  {PLATFORM_LABELS[p]}
                </span>
                {metaConnected ? (
                  <Badge tone="live">live account connected</Badge>
                ) : (
                  <Badge tone="demo">seeded demo data</Badge>
                )}
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">{cfg.note}</p>

              {p === "meta" ? (
                <MetaConnect
                  connected={
                    connections.meta
                      ? {
                          accountName: connections.meta.accountName,
                          accountId: connections.meta.accountId,
                        }
                      : null
                  }
                />
              ) : (
                <div className="mt-3">
                  <button
                    disabled
                    title="Requires a provisioned developer app — the next adapter to build"
                    className="min-h-9 rounded-md border border-line bg-surface-2 px-4 text-[13px] text-ink-faint"
                  >
                    Connect — adapter planned
                  </button>
                </div>
              )}

              <p className="mt-2.5 text-[11.5px] text-ink-faint">
                adapter:{" "}
                <code className="rounded bg-surface-2 px-1 py-0.5">
                  {p === "meta" ? "src/lib/adapters/meta-live.ts + seeded.ts" : "src/lib/adapters/seeded.ts"}
                </code>
              </p>
            </Card>
          );
        })}
      </div>

      <h2 className="mb-3 mt-8 text-[13px] font-medium text-ink-muted">Live services</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {SERVICES.map((s) => {
          const configured = Boolean(process.env[s.envVar]);
          return (
            <Card key={s.name}>
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold">{s.name}</span>
                {configured ? (
                  <Badge tone="live">connected</Badge>
                ) : (
                  <Badge tone="neutral">not configured</Badge>
                )}
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">{s.role}</p>
              <p className="mt-2 text-[11.5px] text-ink-faint">
                env: <code className="rounded bg-surface-2 px-1 py-0.5">{s.envVar}</code>
                {!configured && " — features fall back to cached/sample output without it"}
              </p>
            </Card>
          );
        })}
      </div>
    </>
  );
}
