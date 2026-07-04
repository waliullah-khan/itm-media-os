import Link from "next/link";
import { PLATFORM_LABELS, PLATFORMS, type Platform } from "@/lib/adapters/types";
import { getConnections } from "@/lib/connections/store";
import { getMode } from "@/lib/connections/mode";
import { Badge, Card, PageHeader, PlatformDot } from "@/components/ui";
import { IconPlug } from "@/components/icons";
import { PlatformConnect, ServiceKeysForm } from "./connect-forms";

/** Badges must reflect the runtime environment, not build-time env capture. */
export const dynamic = "force-dynamic";

const PLATFORM_NOTES: Record<Platform, string> = {
  google:
    "Live adapter runs GAQL over the Google Ads REST API. You need a developer token, an OAuth client (ID + secret), an offline refresh token, and the 10-digit customer ID.",
  meta: "Live adapter pulls campaigns + daily insights from the Marketing API. You need an access token with ads_read and the act_ account ID.",
  taboola:
    "Live adapter authenticates client-credentials against Backstage and reads the campaign-day report. You need the API client ID/secret and your account ID.",
  tiktok:
    "Live adapter reads the integrated report (campaign + ad level) from the Marketing API. You need an access token and the numeric advertiser ID.",
};

const SERVICES = [
  {
    name: "Anthropic (Claude)",
    envVar: "ANTHROPIC_API_KEY",
    role: "AI Analyst weekly reviews · report generation · creative analysis + reproduction prompts",
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
  const mode = await getMode();

  // In the seeded demo board, connecting accounts / entering keys is disabled
  // by design — the demo can't reach or expose anything private. Connecting
  // only makes sense on the live board.
  if (mode === "seeded") {
    return (
      <>
        <PageHeader
          title="Connections"
          subtitle="Connect real ad accounts and API keys to power the live board."
        />
        <div className="mt-4 rounded-lg border border-dashed border-line-strong bg-surface p-10 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
            <IconPlug size={20} />
          </div>
          <h2 className="mt-3 text-[15px] font-semibold">
            You&apos;re on the seeded demo board
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-muted">
            Account connections and API keys are only used by the live board. The seeded
            board runs entirely on the demo dataset — it never touches accounts or keys,
            so there&apos;s nothing to configure here. Switch to <strong>Live</strong> using
            the toggle at the top to connect your Google, Meta, TikTok, or Taboola accounts.
          </p>
          <p className="mx-auto mt-3 max-w-md text-[12px] text-ink-faint">
            Explore the full tool on realistic sample data first — every module works on the
            seeded board with zero setup.
          </p>
        </div>
      </>
    );
  }

  const connections = await getConnections();
  const hasVisitorKeys = Boolean(
    connections.services &&
      (connections.services.anthropicKey ||
        connections.services.apifyToken ||
        connections.services.firecrawlKey),
  );

  return (
    <>
      <PageHeader
        title="Connections"
        subtitle="Every ad platform is served through one PlatformAdapter interface. Connect a real account and a live API adapter replaces the seeded one — changing zero lines of dashboard, analyst, automation, or planner code. Credentials live only in your encrypted cookie."
        actions={<Badge tone="live">live board</Badge>}
      />

      <h2 className="mb-3 text-[13px] font-medium text-ink-muted">
        Ad platforms — connect your accounts
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {PLATFORMS.map((p) => {
          const conn = connections[p];
          return (
            <Card key={p}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[14px] font-semibold">
                  <PlatformDot platform={p} />
                  {PLATFORM_LABELS[p]}
                </span>
                {conn ? (
                  <Badge tone="live">live account connected</Badge>
                ) : (
                  <Badge tone="demo">seeded demo data</Badge>
                )}
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
                {PLATFORM_NOTES[p]}
              </p>
              <PlatformConnect
                platform={p}
                label={PLATFORM_LABELS[p]}
                connected={conn ? { accountName: conn.accountName } : null}
              />
              <p className="mt-2.5 text-[11.5px] text-ink-faint">
                adapter:{" "}
                <code className="rounded bg-surface-2 px-1 py-0.5">
                  src/lib/adapters/{p === "meta" ? "meta" : p}-live.ts
                </code>{" "}
                · falls back to seeded data if the live pull fails
              </p>
            </Card>
          );
        })}
      </div>

      <h2 className="mb-3 mt-8 text-[13px] font-medium text-ink-muted">Live services</h2>
      <ServiceKeysForm hasVisitorKeys={hasVisitorKeys} />
      <div className="grid gap-4 md:grid-cols-2">
        {SERVICES.map((s) => {
          const visitorHas =
            (s.envVar === "ANTHROPIC_API_KEY" && connections.services?.anthropicKey) ||
            (s.envVar === "APIFY_TOKEN" && connections.services?.apifyToken) ||
            (s.envVar === "FIRECRAWL_API_KEY" && connections.services?.firecrawlKey);
          const envHas = Boolean(process.env[s.envVar]);
          return (
            <Card key={s.name}>
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold">{s.name}</span>
                {visitorHas ? (
                  <Badge tone="live">your key</Badge>
                ) : envHas ? (
                  <Badge tone="live">connected</Badge>
                ) : (
                  <Badge tone="neutral">not configured</Badge>
                )}
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">{s.role}</p>
              <p className="mt-2 text-[11.5px] text-ink-faint">
                env: <code className="rounded bg-surface-2 px-1 py-0.5">{s.envVar}</code>
                {!envHas && !visitorHas && " — or add your own key above"}
              </p>
            </Card>
          );
        })}
      </div>
    </>
  );
}
