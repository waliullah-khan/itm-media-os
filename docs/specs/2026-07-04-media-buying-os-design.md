# Media Buying OS — Design Spec

**Date:** 2026-07-04 (contest deadline: tonight 11:59 PM ET)
**Purpose:** Submission for the It's Today Media build contest — a hosted, clickable media-buying command center for an affiliate marketing team that buys at scale on Google, Meta, Taboola, and TikTok.

## Goals

1. A live Vercel URL a judge can click and use with zero setup.
2. Demonstrates real media-buying value: cross-platform reporting, AI analysis, competitor ad intelligence, safe automations, budget planning.
3. Code another engineer could extend: clean adapter architecture, typed data model, tests on the real logic.
4. Zero leakage of prior client work (EMLM/Cadvocates data, credentials, reports).

## Non-goals

- Real OAuth to ad platforms (adapter seam + seeded data instead; named as next step in README).
- A database (all state is deterministic seed data + cached JSON; persistence is a named next step).
- User accounts/auth (open demo with rate limiting on expensive routes).

## Architecture

Single **Next.js 15 (App Router, TypeScript, Tailwind)** app deployed on Vercel. New standalone git repo (`itm-media-os`), public on GitHub.

```
src/
  app/                    # routes (below)
  lib/
    adapters/             # PlatformAdapter interface + implementations
      types.ts            # AccountSummary, Campaign, DailyMetric, Ad, ...
      registry.ts         # platform registry (google|meta|taboola|tiktok)
      seeded/             # seeded adapter reading the generated dataset
    data/
      generate.ts         # deterministic seed generator (committed)
      seed.json           # generated dataset (committed, reproducible)
      aggregate.ts        # metric aggregation (scorecards, trends, deltas)
    analyst/              # Claude prompt assembly + streaming
    intelligence/         # Apify Meta Ad Library client, Firecrawl client,
                          # creative analysis prompts, cached runs
    automations/          # rules engine (evaluate rules -> pending actions)
    planner/              # marginal-ROAS budget allocation
    ratelimit.ts          # in-memory token bucket for live routes
```

### Data model (adapter layer)

`PlatformAdapter` interface: `getAccountSummary(range)`, `getCampaigns(range)`, `getDailyMetrics(range)`, `getAds(campaignId, range)`.

Entities (affiliate economics throughout):

- **Campaign:** id, platform, name, vertical (home-services | insurance | health | finance), status, dailyBudget, objective.
- **DailyMetric:** date, campaignId, spend, revenue (payout), impressions, clicks, conversions (leads), derived: CPC, CTR, CVR, CPA, EPC, ROAS, profit.
- **Ad:** id, campaignId, name, format (image|video|native|search), headline, hook, thumbnailColor (placeholder art), metrics.

### Seed dataset

`generate.ts` is a **seeded PRNG** (fixed seed, committed output) producing ~30 campaigns across the 4 platforms, 90 days of daily metrics each, with **planted stories** the AI Analyst should find:

1. A Meta campaign with creative fatigue — CTR decays ~40% over 3 weeks while frequency climbs; CPA rising.
2. A Taboola campaign quietly printing money — ROAS ~3.2, spend flat (scaling opportunity).
3. A Google search campaign with rising CPCs (auction pressure) — margin compressing.
4. A TikTok campaign that spiked then died (viral creative burnout).
5. One home-services campaign where weekend CVR is materially higher than weekdays (dayparting opportunity).

Everything else is plausible noise: weekly seasonality, platform-typical CTR/CPC ranges, some paused campaigns.

## Modules (build priority order)

### 1. Command Center — `/` and `/campaigns`

- Scorecards: spend, revenue, profit, blended ROAS, leads, blended CPA — with period-over-period deltas (last 30d vs prior 30d default; 7d toggle).
- Trend chart: daily spend vs revenue (profit shading), 90 days.
- Platform breakdown table: per-platform spend/revenue/ROAS/CPA + share bars.
- Top 5 / Bottom 5 campaigns by profit; anomaly chips (from the planted stories, detected by simple stat rules — e.g. CTR decay, CPC trend).
- `/campaigns`: sortable/filterable table (platform, vertical, status), row click → campaign detail (`/campaigns/[id]`): trend, ads list, ad-level metrics.

### 2. AI Analyst — `/analyst`

- One click → server route assembles compact aggregates (NOT raw rows) → **streams** a Claude-written review: Scorecard read → What's Working → What's Broken (root-cause hypotheses per underperformer) → Budget Reallocation with $ impact estimates → Watch Next Week.
- Model: `claude-sonnet-5` (streamed via `@anthropic-ai/sdk`). Response cached in-memory by (range) key; rate-limited.
- Fallback: a committed pre-generated analysis with a "cached result" badge if the API errors.

### 3. Ad Intelligence — `/intelligence` (the AONIC / n8n rebuild)

- Input: niche keyword or brand/page name + country.
- Pipeline (server route): Apify Meta Ad Library actor run → normalize ads (creative URL, body, CTA, start date, platforms) → Claude analyzes each (hook, angle, format, target emotion, why-it-works) → **reproduction prompt** per ad (the AONIC signature feature).
- Ships with 2–3 **pre-run cached researches** (committed JSON, e.g. "home security", "GLP-1 weight loss", one brand) so it demos instantly; "Run live" button does a real Apify run behind rate limiting (capped ads per run).
- Firecrawl: scrape the top ad's landing page → funnel notes (offer, form length, trust signals) in the analysis.
- A Vercel cron route (`/api/cron/refresh-intel`) wired but env-gated — demonstrates the n8n schedule going native.

### 4. Automation Studio — `/automations`

- Rules engine: typed conditions over rolling windows (metric, comparator, threshold, window, scope) → actions (pause, scale ±%, alert). Ships with 5 preset rules matching media-buyer practice ("pause if CPA > $40 for 3d", "scale +20% if ROAS > 2.5 for 7d", creative-fatigue alert...).
- Evaluate against seed data → **pending-actions queue** with evidence (the metric window that triggered) → approve / reject buttons (state in-memory per session; approval marks the action "queued for platform push" — draft-only, never auto-executes). Rule builder UI for adding a custom rule (client-side).

### 5. Media Planner + Connections — `/planner`, `/connections`

- Planner: total daily budget slider → allocation across platforms/campaigns from diminishing-returns curves fit on seed history (marginal ROAS), with projected leads/profit at the chosen budget + Claude one-paragraph rationale (cached fallback).
- Connections: cards for Google/Meta/Taboola/TikTok (demo-data badge, "what a live connection needs" note) + Anthropic/Apify/Firecrawl (live badge, health-checked).

## Error handling & judging resilience

- Every live external call (Anthropic, Apify, Firecrawl) has: timeout, in-memory rate limit, and a committed cached fallback rendered with a visible "cached" badge. The demo never white-screens.
- API keys server-side only (Vercel env vars). `.env.example` documents them; app runs fully on seed data with zero keys.

## Testing

Vitest on the two real-logic modules: `automations/` (rule evaluation windows, comparators, scoping) and `data/aggregate.ts` (rollups, deltas, derived metrics). UI untested (time).

## Deployment

Vercel from first hour, continuous deploys on push to `main`. Public GitHub repo. Optional custom domain at the end if time allows.

## Cut-line

Modules 1–3 = submittable. 4–5 = strong bonuses. README + deploy are never cut.

## README (contest questions)

1. **What does it do** — the five modules, one paragraph each.
2. **Why this one** — mirrors ITM's actual operation (scale buying on exactly these 4 platforms, research → report → optimize loop); consolidates the daily media-buyer workflow into one tool; HITL automation philosophy.
3. **What next** — real platform OAuth via the adapter seam, Postgres persistence, automation push-to-platform with approval audit trail, creative generation loop (research → reproduction prompt → generated variant → launch as paused draft), Slack digest.
