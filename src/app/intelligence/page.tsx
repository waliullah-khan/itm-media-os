"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Research, QueryKind } from "@/lib/intelligence/types";
import { SAMPLE_RESEARCHES } from "@/lib/intelligence/samples";
import { Badge, Card, PageHeader } from "@/components/ui";
import { IconRadar, IconExternal, IconCheck } from "@/components/icons";

interface RunHandle {
  runId: string;
  datasetId: string;
  query: string;
  kind: QueryKind;
  country: string;
}

interface RecentResearch {
  runId: string;
  query: string;
  kind: QueryKind;
  country: string;
  source: string;
  adsCount: number;
  createdAt: string;
}

const RUN_KEY = "mbos-intel-run";

export default function IntelligencePage() {
  const [research, setResearch] = useState<Research>(SAMPLE_RESEARCHES[0]);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<QueryKind>("keyword");
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentResearch[]>([]);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted research history (Supabase). Survives restarts, and the
  // Railway watchlist worker's runs show up here too.
  const loadRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/intelligence/history");
      if (res.ok) {
        const json = await res.json();
        setRecent(json.recent ?? []);
      }
    } catch {
      // history is a nicety — ignore failures
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  async function openRecent(runId: string) {
    try {
      const res = await fetch(`/api/intelligence/history?runId=${encodeURIComponent(runId)}`);
      if (res.ok) {
        const json = await res.json();
        setResearch(json.research as Research);
        setError(null);
      }
    } catch {
      setError("Couldn't load that saved research.");
    }
  }

  /**
   * The scrape runs server-side on Apify — the browser only polls for the
   * result, so switching tabs, sleeping the laptop, or even reloading the
   * page (the run handle is kept in sessionStorage) can't kill a run.
   */
  const poll = useCallback(async (handle: RunHandle, attempt = 0) => {
    if (attempt > 90) {
      setError("The run is taking unusually long — it may still finish; try again shortly.");
      setRunning(false);
      sessionStorage.removeItem(RUN_KEY);
      return;
    }
    try {
      const params = new URLSearchParams({
        runId: handle.runId,
        datasetId: handle.datasetId,
        query: handle.query,
        kind: handle.kind,
        country: handle.country,
      });
      const res = await fetch(`/api/intelligence/status?${params}`);
      const json = await res.json();

      if (json.status === "done") {
        setResearch(json.research as Research);
        setRunning(false);
        setPhase("");
        sessionStorage.removeItem(RUN_KEY);
        loadRecent();
        return;
      }
      if (json.status === "failed" || (!res.ok && res.status !== 502)) {
        setError(json.error ?? "The run failed.");
        setRunning(false);
        sessionStorage.removeItem(RUN_KEY);
        return;
      }
      setPhase(
        json.status === "running"
          ? "Scraping the Ad Library on Apify — safe to switch tabs…"
          : "Scrape finished — analyzing creatives with Claude…",
      );
      pollTimer.current = setTimeout(() => poll(handle, attempt + 1), 5000);
    } catch {
      // transient network blip — keep polling
      pollTimer.current = setTimeout(() => poll(handle, attempt + 1), 8000);
    }
  }, [loadRecent]);

  // Resume an in-flight run after a reload.
  useEffect(() => {
    const saved = sessionStorage.getItem(RUN_KEY);
    if (saved) {
      try {
        const handle = JSON.parse(saved) as RunHandle;
        setQuery(handle.query);
        setKind(handle.kind);
        setRunning(true);
        setPhase("Resuming your run…");
        poll(handle);
      } catch {
        sessionStorage.removeItem(RUN_KEY);
      }
    }
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [poll]);

  async function runLive() {
    if (query.trim().length < 2 || running) return;
    setRunning(true);
    setError(null);
    setPhase("Starting the scrape…");
    try {
      const res = await fetch("/api/intelligence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: query.trim(), kind, country: "US" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Request failed (${res.status})`);
        setRunning(false);
        return;
      }
      const handle = json as RunHandle;
      sessionStorage.setItem(RUN_KEY, JSON.stringify(handle));
      poll(handle);
    } catch {
      setError("Network error starting the pipeline.");
      setRunning(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Ad Intelligence"
        subtitle="Type a niche or a brand page → the Meta Ad Library is scraped (Apify), each creative is reverse-engineered by Claude, and every ad gets a reproduction prompt your creative team can execute. Native replacement for the team's n8n scraper workflow."
        actions={
          research.source === "live" ? (
            <Badge tone="live">live run</Badge>
          ) : (
            <Badge tone="cached">sample research</Badge>
          )
        }
      />

      {/* Search bar */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-line bg-surface-2 p-0.5">
            {(
              [
                ["keyword", "Niche keyword"],
                ["page", "Brand page"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`min-h-9 cursor-pointer rounded px-3 text-[12.5px] font-medium transition-colors ${
                  kind === k ? "bg-primary-soft text-ink" : "text-ink-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runLive()}
            placeholder={
              kind === "keyword"
                ? "e.g. solar panels, debt relief, medicare…"
                : "e.g. simplisafe or a facebook.com page URL"
            }
            aria-label="Research query"
            className="min-h-9 min-w-64 flex-1 rounded-md border border-line bg-surface-2 px-3 text-[13.5px] placeholder:text-ink-faint focus:border-primary focus:outline-none"
          />
          <button
            onClick={runLive}
            disabled={running || query.trim().length < 2}
            className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md bg-primary px-4 text-[13px] font-medium text-white transition hover:bg-primary-hover active:translate-y-px disabled:cursor-default disabled:opacity-40"
          >
            <IconRadar size={15} />
            {running ? "Researching…" : "Run live research"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-faint">
          Sample researches:
          {SAMPLE_RESEARCHES.map((s) => (
            <button
              key={s.query}
              onClick={() => {
                setResearch(s);
                setError(null);
              }}
              className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-[12px] transition-colors ${
                research.query === s.query && research.source === "sample"
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-line text-ink-muted hover:text-ink"
              }`}
            >
              {s.query}
            </button>
          ))}
        </div>

        {recent.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-faint">
            Recent (saved to Supabase):
            {recent.map((r) => (
              <button
                key={r.runId}
                onClick={() => openRecent(r.runId)}
                title={`${r.adsCount} ads · ${new Date(r.createdAt).toLocaleString("en-US")}`}
                className="flex cursor-pointer items-center gap-1 rounded-full border border-line px-2.5 py-0.5 text-[12px] text-ink-muted transition-colors hover:text-ink"
              >
                {r.source === "watchlist" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" title="watchlist worker" />
                )}
                {r.query}
              </button>
            ))}
          </div>
        )}

        {running && (
          <div className="mt-3 flex items-center gap-2 text-[13px] text-ink-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            {phase || "Working…"} <span className="text-ink-faint">(1-3 min total)</span>
          </div>
        )}
        {error && (
          <div className="mt-3 rounded-md border border-neg/30 bg-neg/5 p-2.5 text-[13px] text-neg">
            {error}
          </div>
        )}
      </Card>

      {/* Research header */}
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <h2 className="text-[15px] font-semibold">
          “{research.query}” <span className="text-ink-faint">· {research.country}</span>
        </h2>
        <span className="text-[12px] text-ink-faint">
          {research.ads.length} ads · fetched {new Date(research.fetchedAt).toLocaleDateString("en-US")}
        </span>
      </div>

      {/* Patterns + recommendations */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card title="Patterns across these ads">
          <ul className="space-y-2">
            {research.patterns.map((p, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-relaxed">
                <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-accent" />
                {p}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="What your team should do">
          <ul className="space-y-2">
            {research.recommendations.map((r, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-relaxed">
                <IconCheck size={14} className="mt-0.5 shrink-0 text-pos" />
                {r}
              </li>
            ))}
          </ul>
          {research.landingPageNotes && (
            <div className="mt-3 rounded-md border border-line bg-surface-2/50 p-3">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                Landing page funnel (via Firecrawl)
              </div>
              <p className="text-[12.5px] leading-relaxed text-ink-muted">
                {research.landingPageNotes}
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Ad cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {research.ads.map((ad) => {
          const a = research.analyses.find((x) => x.adId === ad.id);
          return (
            <Card key={ad.id} className="flex flex-col">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="text-[14px] font-semibold">{ad.pageName}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
                    {ad.startedRunning && <span>running since {ad.startedRunning}</span>}
                    {ad.platforms.length > 0 && <span>· {ad.platforms.join(", ")}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {ad.mediaKind && <Badge tone="neutral">{ad.mediaKind}</Badge>}
                  {ad.ctaType && <Badge tone="demo">{ad.ctaType.replace(/_/g, " ").toLowerCase()}</Badge>}
                </div>
              </div>

              {ad.mediaUrl && ad.mediaKind === "image" && (
                // FB CDN URLs are short-lived and arbitrary-host — plain img is correct here
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ad.mediaUrl}
                  alt={`${ad.pageName} ad creative`}
                  referrerPolicy="no-referrer"
                  className="mb-2 max-h-56 w-full rounded-md border border-line object-cover"
                />
              )}

              {ad.body && (
                <p className="mb-3 rounded-md border border-line bg-surface-2/40 p-2.5 text-[12.5px] leading-relaxed text-ink/85">
                  {ad.body.length > 280 ? `${ad.body.slice(0, 280)}…` : ad.body}
                </p>
              )}

              {a && (
                <div className="mt-auto space-y-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="cached">{a.angle}</Badge>
                    <Badge tone="neutral">{a.format}</Badge>
                    <Badge tone="neutral">{a.emotion}</Badge>
                  </div>
                  <div className="text-[12.5px] leading-relaxed">
                    <span className="font-medium text-ink-muted">Hook: </span>
                    {a.hook}
                  </div>
                  <div className="text-[12.5px] leading-relaxed text-ink-muted">
                    {a.whyItWorks}
                  </div>
                  <ReproductionPrompt text={a.reproductionPrompt} />
                </div>
              )}

              {ad.landingUrl && (
                <a
                  href={ad.landingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2.5 inline-flex items-center gap-1 text-[12px] text-primary hover:underline"
                >
                  landing page <IconExternal size={12} />
                </a>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}

function ReproductionPrompt({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-md border border-primary/25 bg-primary/5">
      <button
        onClick={() => setOpen(!open)}
        className="flex min-h-9 w-full cursor-pointer items-center justify-between px-3 text-[12.5px] font-medium text-primary"
        aria-expanded={open}
      >
        Reproduction prompt
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          <p className="text-[12.5px] leading-relaxed text-ink/85">{text}</p>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="mt-2 min-h-8 cursor-pointer rounded border border-line bg-surface-2 px-2.5 text-[11.5px] text-ink-muted hover:text-ink"
          >
            {copied ? "Copied ✓" : "Copy for creative team"}
          </button>
        </div>
      )}
    </div>
  );
}
