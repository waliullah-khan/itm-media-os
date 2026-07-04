# Media Buying OS

A command center for a media buying team that runs paid traffic at scale on **Google, Meta, Taboola, and TikTok** — cross-platform reporting, an AI analyst that writes the weekly review, competitor ad intelligence with reproduction prompts, a rules engine with human-in-the-loop approvals, and a marginal-ROAS budget planner.

Built for the It's Today Media build contest.

**Two boards, one toggle.** A switch at the top of every page flips between the **Seeded demo board** (a realistic 90-day dataset — explore the whole tool with zero setup, no accounts, no keys) and the **Live board** (only data from ad accounts *you* connect). The seeded board never touches accounts or keys; the live board is empty until you connect something. Judges can click through everything on seeded data immediately, then flip to Live to prove the real integrations.

**The architecture is real, not a mock.** Vercel serves the app; **Apify** runs the ad-library scrapes; a **Railway** worker keeps a competitor watchlist fresh on a schedule; **Supabase** persists research history that both the app and the worker read and write. Each piece does the job it's actually good at.

---

## What does this tool do?

**Command Center** (`/`) — every platform in one view: spend, revenue, profit, blended ROAS/CPA with period-over-period deltas, a 90-day trend, platform breakdown, top/bottom campaigns, and rule-detected signals (creative fatigue, CPC inflation, under-scaled winners, dayparting opportunities). Click through to any campaign for its trend and ad-level performance.

**AI Analyst** (`/analyst`) — one click and Claude reads the same rollups the dashboard renders and streams the review a senior buyer would spend an hour writing: verdict, what's working, what's broken *with root-cause hypotheses*, a move-money plan in dollars, and what to watch next week. Grounded in the account's actual numbers — never a generic essay.

**Ad Intelligence** (`/intelligence`) — type a niche ("home security") or a brand page. The Meta Ad Library is scraped live (Apify), the top ad's landing page is pulled for funnel context (Firecrawl), and Claude reverse-engineers every creative: hook, angle, format, emotion, why it works — plus a **reproduction prompt** your creative team (or an image/video model) can execute directly. The scrape runs *asynchronously on Apify* and the browser only polls for the result, so switching tabs, sleeping the laptop, or reloading the page can't kill a run. Ships with sample researches so it demos instantly; completed runs persist to Supabase and reappear under "Recent" — including the ones the Railway watchlist worker produces on its own.

**Automation Studio** (`/automations`) — declarative rules over rolling windows ("pause if CPA > $70 over 4 days", "scale +20% if ROAS > 2.0 for a week", "alert on CTR −20% vs prior 3 weeks"). Every triggered action lands in a **pending queue with its evidence and an estimated monthly $ impact** — including a negative estimate when the rule fires on a campaign that's still profitable, which is exactly why nothing executes without a human clicking Approve. Build and evaluate your own rule live.

**Media Planner** (`/planner`) — every campaign gets a diminishing-returns curve fit on its trailing 14 days; drag one slider and the total budget re-allocates by *marginal* ROAS with projected revenue, profit, and leads. Answers the question a budget meeting actually asks: "if we had $2K/day more (or less), where does it go?"

**Reports** (`/reports`) — a library of nine one-click reports ported from the Claude Code skill systems I built for two real client workspaces (an agency growth system and an ecommerce CRO system): Google/Meta performance reviews with root-cause hypotheses, weekly learning synthesis, cross-platform insight transfer, a CFO-view profit report, an ICE-scored test backlog, a production-ready creative brief builder, and a client-facing weekly report. Each runs its source skill's analytical structure against the account data and streams back a working document — analyst output, not chatbot output.

**Connections** (`/connections`, live board only) — connect real accounts on **all four platforms** (Meta, Google Ads, TikTok, Taboola): credentials are validated against each platform's API, stored only in your encrypted httpOnly cookie (AES-256-GCM, never server-side), and a live adapter replaces the seeded one — every module then reads your real delivery. You can also bring your own Anthropic/Apify/Firecrawl keys to run the live AI features on your own quota. In the seeded demo board this page is intentionally disabled — the demo can't reach or expose anything private.

### How it's wired

```
src/lib/adapters/     PlatformAdapter interface + registry
                      seeded.ts + LIVE adapters: meta-live, google-live (GAQL REST),
                      tiktok-live, taboola-live — swapped in per-visitor on connect
src/lib/connections/  encrypted per-visitor credential store (AES-256-GCM cookie)
                      + board-mode gate (seeded vs live)
src/lib/data/         deterministic dataset generator (planted stories) + pure aggregation
                      + mode-aware world facade (seeded dataset vs connected accounts)
src/lib/analyst/      context assembly + prompt + streamed Claude review
src/lib/reports/      report templates ported from the client-workspace skills + context
src/lib/intelligence/ Apify ad-library client (async run + poll) + Firecrawl + Claude analysis
src/lib/supabase.ts   research-history persistence (PostgREST, no SDK)
src/lib/automations/  rules engine → pending actions (tested)
src/lib/planner/      curve fitting + greedy marginal-ROAS allocation
src/app/              Next.js App Router pages + API routes
worker/               standalone Railway service: scheduled watchlist refresh
                      (Apify scrape → Claude analysis → Supabase)
```

**The runtime, honestly split by what each host is good at:**

- **Vercel** serves the Next.js app and its API routes (streamed AI, per-visitor adapters). Serverless is perfect for request/response and streaming.
- **Apify** runs the actual ad-library scrapes. A scrape is a multi-minute browser job — it belongs on a scraping platform, not inside a serverless function, and the app just starts a run and polls. This is *why* tab-switching no longer kills a scrape.
- **Railway** runs the watchlist worker — a durable loop that refreshes a competitor watchlist on an interval, fanning out Apify runs and analyzing them with Claude with no request holding it open and no function ceiling. This is the workload serverless genuinely can't do; Railway is the right home for it. (`worker/README.md`.)
- **Supabase** stores research history. Both the app (on-demand runs) and the worker (scheduled runs) write to one `research_runs` table with RLS; the Ad Intelligence page reads it back under "Recent."

The four ad platforms are served by a **seeded adapter** behind the same `PlatformAdapter` interface the four live adapters implement — connecting an account swaps implementations without touching a single consumer. The demo dataset is generated, not hand-written: a fixed-seed PRNG produces 90 days × 30 campaigns of affiliate-economics data (payout revenue, EPC, CPA) with **planted stories** — a fatiguing Meta UGC creative, a Google campaign under auction pressure, a Taboola winner nobody scaled, a TikTok viral spike that burned out, a weekend-CVR pattern — so the analytics, AI, and automations have real signals to find, and you can verify they find them.

Everything live (Claude, Apify, Firecrawl, Supabase) degrades gracefully: no key / no connection → clearly-labeled cached, sample, or empty-state output. The demo never white-screens.

---

## Why did I build THIS one?

Because it's the tool the job description describes, end to end. It's Today Media buys at scale on exactly these four platforms, reports on that data to optimize, and builds funnels to collect leads. The daily loop of that operation is: *check performance → diagnose → research competitors → brief creative → adjust budgets → repeat*. Each module is one leg of that loop, and they share one data spine.

Three specific bets:

1. **Consolidation is the value.** A media buyer's day is fragmented across four ads managers, a spreadsheet, an ad-library tab, and Slack. Putting reporting, diagnosis, research, and budget planning on one data model is worth more than any single feature — and the adapter pattern makes "plug in the real accounts" an integration task, not a rewrite.

2. **AI should do analyst work, not chatbot work.** The AI Analyst and the creative reverse-engineering aren't text boxes bolted onto a dashboard — they're opinionated workflows with structure, grounding data, and a defined output a team can act on. The reproduction prompt turns competitor research into a creative brief in one step.

3. **Automation earns trust through guardrails.** Real accounts spend real money, so the rules engine proposes and humans dispose. The impact estimator even argues *against* its own rule when pausing would cost profit. That's the difference between a tool a team adopts and a tool a team disables after the first bad auto-pause.

I also rebuilt an existing n8n workflow (Apify Meta-ads scraper → AI analysis → storage) natively inside the app — same pipeline, but typed, testable, rate-limited, and deployed with the product instead of living in a separate automation tool.

## What would I build next if this were my full-time job?

In priority order:

1. **OAuth-grade platform auth.** The four live adapters exist and work with directly-supplied credentials; the next step is proper OAuth flows (Google/TikTok app review, Meta business verification) so connecting is two clicks instead of pasting tokens, plus MCC/multi-account support.
2. **Multi-user + more persistence.** Supabase already stores research history; extend it to report archives, automation audit logs, approved-action records, and saved plans, behind per-team auth — so the encrypted-cookie credential store becomes a proper per-user vault.
3. **Grow the Railway worker into the automation engine.** The scheduled watchlist worker is the template: the same durable-loop pattern evaluates every connected account's rules every 15 minutes and pushes approved actions to platform APIs (paused status, budget changes) with dry-run mode, change history, and one-click rollback — the draft-first philosophy, now with teeth, running where a serverless function can't.
4. **Creative pipeline.** Ad Intelligence reproduction prompt → image/video generation → human review → launch as a paused draft in the target account. Research-to-live-test in under an hour.
5. **Alerting where the team lives.** The signals and automation queue land in Slack with approve/reject buttons; the weekly AI review lands in email every Monday morning.
6. **Lead-side data.** Join platform spend with lead-delivery/payout feeds from affiliate networks so ROAS is computed on *actual* revenue, and the planner optimizes on true margin by offer.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:3000 — fully functional on seeded data, zero keys needed
npm test           # vitest: aggregation + rules engine
npm run sanity     # prints the dataset scorecard + detected stories
```

The seeded demo board needs **zero** keys. Everything below is optional and only powers the **live** board / live AI features — and any visitor can supply their own Anthropic/Apify/Firecrawl keys from the Connections page (live board) instead of setting them here.

| Variable | Enables |
|---|---|
| `ANTHROPIC_API_KEY` | AI Analyst, Reports, live creative analysis |
| `APIFY_TOKEN` | Ad Library scraping |
| `FIRECRAWL_API_KEY` | Landing-page funnel notes |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Research-history persistence (shared with the worker) |
| `CONNECTIONS_SECRET` | Key for the encrypted per-visitor credential cookie |
| `CRON_SECRET` | The scheduled ad-library refresh route |
| `ANALYST_MODEL` | Override the Claude model (default `claude-sonnet-5`) |

Deployed on **Vercel**; the **Railway** worker (`worker/`) runs the scheduled watchlist refresh; **Supabase** stores research history. Open routes that call paid APIs are rate-limited per IP and fall back to cached / sample output on failure.

### The Railway worker

`worker/` is a standalone Node service (its own `package.json`, deployed separately on Railway with root directory `worker/`). It refreshes a competitor-ad watchlist on an interval — the durable, long-running workload that doesn't fit serverless. See `worker/README.md`. It needs `APIFY_TOKEN`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`; the watchlist and cadence are configurable via `WATCHLIST` and `REFRESH_INTERVAL_MINUTES`.
