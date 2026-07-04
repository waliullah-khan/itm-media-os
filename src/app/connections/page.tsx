import { PLATFORM_LABELS, PLATFORMS } from "@/lib/adapters/types";
import { getAdapter } from "@/lib/adapters/registry";
import { Badge, Card, PageHeader, PlatformDot } from "@/components/ui";

/** What a live integration for each seeded platform requires — the honest
 * production checklist, not vaporware. */
const PLATFORM_LIVE_NOTES: Record<string, string> = {
  google:
    "OAuth2 + developer token via the Google Ads API; GAQL queries land in the adapter's getDailyMetrics/getCampaigns.",
  meta:
    "Marketing API system-user token; insights endpoint with per-day breakdown maps 1:1 onto the adapter interface.",
  taboola:
    "Backstage API client-credentials token; campaign-summary reports feed the same DailyMetric shape.",
  tiktok:
    "Marketing API access token; the reporting endpoint's daily metrics normalize into the adapter in ~50 lines.",
};

/** Badges must reflect the runtime environment, not build-time env capture. */
export const dynamic = "force-dynamic";

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
  return (
    <>
      <PageHeader
        title="Connections"
        subtitle="Every ad platform is served through one PlatformAdapter interface. The four platforms below run on the seeded demo adapter; swapping any of them for a live API client changes zero lines of dashboard, analyst, automation, or planner code."
      />

      <h2 className="mb-3 text-[13px] font-medium text-ink-muted">Ad platforms — adapter layer</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {PLATFORMS.map((p) => {
          const adapter = getAdapter(p);
          return (
            <Card key={p}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[14px] font-semibold">
                  <PlatformDot platform={p} />
                  {PLATFORM_LABELS[p]}
                </span>
                <Badge tone="demo">seeded demo data</Badge>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
                {PLATFORM_LIVE_NOTES[p]}
              </p>
              <p className="mt-2 text-[11.5px] text-ink-faint">
                adapter: <code className="rounded bg-surface-2 px-1 py-0.5">src/lib/adapters/seeded.ts</code>{" "}
                · mode: <code className="rounded bg-surface-2 px-1 py-0.5">{adapter.mode}</code>
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
