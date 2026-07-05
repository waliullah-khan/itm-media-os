# Media Buying OS

A command center for a media buying team that runs paid traffic at scale on Google, Meta, Taboola, and TikTok. It does cross-platform reporting, an AI analyst that writes the weekly review, competitor ad intelligence with reproduction prompts, a rules engine with human-in-the-loop approvals, and a marginal-ROAS budget planner.

Built for the It's Today Media build contest.

A switch at the top of every page flips between two boards. The seeded demo board is a realistic 90-day dataset you can explore with zero setup: no accounts, no keys. The live board shows only data from ad accounts you connect, so it stays empty until you connect something. The seeded board never touches accounts or keys. A judge can click through everything on seeded data right away, then flip to Live to see the real integrations.

The architecture underneath is real. Vercel serves the app. Apify runs the ad-library scrapes. A Railway worker keeps a competitor watchlist fresh on a schedule. Supabase persists research history that both the app and the worker read and write. Each piece does the job it's actually good at.

---

## What does this tool do?

**Command Center** (`/`) puts every platform in one view: spend, revenue, profit, blended ROAS and CPA with period-over-period deltas, a 90-day trend, a platform breakdown, top and bottom campaigns, and rule-detected signals (creative fatigue, CPC inflation, under-scaled winners, dayparting opportunities). Click any campaign for its trend and ad-level performance.

**AI Analyst** (`/analyst`): one click and Claude reads the same rollups the dashboard renders, then streams the review a senior buyer would spend an hour writing. You get a verdict, what's working, what's broken with root-cause hypotheses, a move-money plan in dollars, and what to watch next week. It works from the account's actual numbers instead of writing a generic essay.

**Ad Intelligence** (`/intelligence`): type a niche ("home security") or a brand page. The Meta Ad Library gets scraped live through Apify, the top ad's landing page is pulled for funnel context through Firecrawl, and Claude reverse-engineers every creative: hook, angle, format, emotion, and why it works. It also writes a reproduction prompt your creative team (or an image or video model) can run directly. The scrape runs on Apify in the background and the browser only polls for the result, so switching tabs, sleeping the laptop, or reloading the page can't kill a run. It ships with sample researches so it demos right away. Completed runs persist to Supabase and reappear under "Recent," including the ones the Railway watchlist worker produces on its own.

**Automation Studio** (`/automations`): declarative rules over rolling windows ("pause if CPA > $70 over 4 days," "scale +20% if ROAS > 2.0 for a week," "alert if CTR drops 20% vs the prior 3 weeks"). Every triggered action lands in a pending queue with its evidence and an estimated monthly dollar impact. That estimate goes negative when a rule fires on a campaign that's still profitable, which is exactly why nothing executes until a human clicks Approve. You can build and evaluate your own rule live.

**Media Planner** (`/planner`): every campaign gets a diminishing-returns curve fit on its trailing 14 days. Drag one slider and the total budget re-allocates by marginal ROAS, with projected revenue, profit, and leads. It answers the question a budget meeting actually asks: if we had $2K/day more or less, where does it go?

**Reports** (`/reports`): a library of nine one-click reports ported from the Claude Code skill systems I built for two real client workspaces, an agency growth system and an ecommerce CRO system. They cover Google and Meta performance reviews with root-cause hypotheses, weekly learning synthesis, cross-platform insight transfer, a CFO-view profit report, an ICE-scored test backlog, a creative brief builder, and a client-facing weekly report. Each one runs its source skill's analytical structure against the account data and streams back a working document that reads like analyst output.

**Connections** (`/connections`, live board only): connect real accounts on all four platforms (Meta, Google Ads, TikTok, Taboola). Credentials are validated against each platform's API and stored only in your encrypted httpOnly cookie (AES-256-GCM, never server-side), and a live adapter replaces the seeded one so every module reads your real delivery. You can also bring your own Anthropic, Apify, or Firecrawl keys to run the live AI features on your own quota. On the seeded demo board this page is turned off on purpose, since the demo can't reach or expose anything private.

### How it's wired

```
src/lib/adapters/     PlatformAdapter interface + registry
                      seeded.ts + LIVE adapters: meta-live, google-live (GAQL REST),
                      tiktok-live, taboola-live, swapped in per-visitor on connect
src/lib/connections/  encrypted per-visitor credential store (AES-256-GCM cookie)
                      + board-mode gate (seeded vs live)
src/lib/data/         deterministic dataset generator (planted stories) + pure aggregation
                      + mode-aware world facade (seeded dataset vs connected accounts)
src/lib/analyst/      context assembly + prompt + streamed Claude review
src/lib/reports/      report templates ported from the client-workspace skills + context
src/lib/intelligence/ Apify ad-library client (async run + poll) + Firecrawl + Claude analysis
src/lib/supabase.ts   research-history persistence (PostgREST, no SDK)
src/lib/automations/  rules engine -> pending actions (tested)
src/lib/planner/      curve fitting + greedy marginal-ROAS allocation
src/app/              Next.js App Router pages + API routes
worker/               standalone Railway service: scheduled watchlist refresh
                      (Apify scrape -> Claude analysis -> Supabase)
```

Each host runs the part it fits:

- **Vercel** serves the Next.js app and its API routes (streamed AI, per-visitor adapters). Serverless fits request/response and streaming.
- **Apify** runs the actual ad-library scrapes. A scrape is a multi-minute browser job, so it belongs on a scraping platform rather than inside a serverless function. The app just starts a run and polls, which is why tab-switching no longer kills a scrape.
- **Railway** runs the watchlist worker, a durable loop that refreshes a competitor watchlist on an interval, fanning out Apify runs and analyzing them with Claude. Nothing holds a request open, and there's no function time ceiling. This is the workload serverless can't do, and Railway is the right home for it. (See `worker/README.md`.)
- **Supabase** stores research history. Both the app (on-demand runs) and the worker (scheduled runs) write to one `research_runs` table with RLS, and the Ad Intelligence page reads it back under "Recent."

The four ad platforms are served by a seeded adapter behind the same `PlatformAdapter` interface the four live adapters implement, so connecting an account swaps implementations without touching a single consumer. The demo dataset is generated, not hand-written: a fixed-seed PRNG produces 90 days across 30 campaigns of affiliate-economics data (payout revenue, EPC, CPA) with planted stories. There's a fatiguing Meta UGC creative, a Google campaign under auction pressure, a Taboola winner nobody scaled, a TikTok viral spike that burned out, and a weekend-CVR pattern. So the analytics, AI, and automations have real signals to find, and you can check that they find them.

Everything live (Claude, Apify, Firecrawl, Supabase) degrades gracefully. With no key or no connection you get clearly labeled cached, sample, or empty-state output. The demo never white-screens.

---

## Why did I build THIS one?

Because it's the tool the job description describes, end to end. It's Today Media buys at scale on exactly these four platforms, reports on that data to optimize, and builds funnels to collect leads. The daily loop of that work is: check performance, diagnose, research competitors, brief creative, adjust budgets, repeat. Each module is one leg of that loop, and they share one data spine.

Three specific bets:

1. **Consolidation is the value.** A media buyer's day is fragmented across four ads managers, a spreadsheet, an ad-library tab, and Slack. Putting reporting, diagnosis, research, and budget planning on one data model is worth more than any single feature, and the adapter pattern makes "plug in the real accounts" an integration task rather than a rewrite.

2. **AI should do analyst work, not chatbot work.** The AI Analyst and the creative reverse-engineering aren't text boxes bolted onto a dashboard. They're opinionated workflows with structure, grounding data, and a defined output a team can act on. The reproduction prompt turns competitor research into a creative brief in one step.

3. **Automation earns trust through guardrails.** Real accounts spend real money, so the rules engine proposes and a human decides. The impact estimator even argues against its own rule when pausing would cost profit. That's the difference between a tool a team adopts and one a team disables after the first bad auto-pause.

I also rebuilt an existing n8n workflow (Apify Meta-ads scraper, then AI analysis, then storage) natively inside the app. Same pipeline, but typed, testable, rate-limited, and deployed with the product instead of living in a separate automation tool.

## What would I build next if this were my full-time job?

In priority order:

1. **OAuth-grade platform auth.** The four live adapters exist and work with directly supplied credentials. The next step is proper OAuth flows (Google and TikTok app review, Meta business verification) so connecting is two clicks instead of pasting tokens, plus MCC and multi-account support.
2. **Multi-user plus more persistence.** Supabase already stores research history. Extend it to report archives, automation audit logs, approved-action records, and saved plans, behind per-team auth, so the encrypted-cookie credential store becomes a proper per-user vault.
3. **Grow the Railway worker into the automation engine.** The scheduled watchlist worker is the template. The same durable-loop pattern can evaluate every connected account's rules every 15 minutes and push approved actions to platform APIs (paused status, budget changes) with dry-run mode, change history, and one-click rollback. Same draft-first approach, running where a serverless function can't.
4. **Creative pipeline.** Ad Intelligence reproduction prompt, then image or video generation, then human review, then launch as a paused draft in the target account. Research to live test in under an hour.
5. **Alerting where the team lives.** The signals and automation queue land in Slack with approve and reject buttons, and the weekly AI review lands in email every Monday morning.
6. **Lead-side data.** Join platform spend with lead-delivery and payout feeds from affiliate networks so ROAS is computed on real revenue, and the planner optimizes on true margin by offer.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:3000 -- fully functional on seeded data, zero keys needed
npm test           # vitest: aggregation + rules engine
npm run sanity     # prints the dataset scorecard + detected stories
```

The seeded demo board needs zero keys. Everything below is optional and only powers the live board and the live AI features. Any visitor can also supply their own Anthropic, Apify, or Firecrawl keys from the Connections page (live board) instead of setting them here.

| Variable | Enables |
|---|---|
| `ANTHROPIC_API_KEY` | AI Analyst, Reports, live creative analysis |
| `APIFY_TOKEN` | Ad Library scraping |
| `FIRECRAWL_API_KEY` | Landing-page funnel notes |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Research-history persistence (shared with the worker) |
| `CONNECTIONS_SECRET` | Key for the encrypted per-visitor credential cookie |
| `CRON_SECRET` | The scheduled ad-library refresh route |
| `ANALYST_MODEL` | Override the Claude model (default `claude-sonnet-5`) |

Deployed on Vercel. The Railway worker (`worker/`) runs the scheduled watchlist refresh, and Supabase stores research history. Open routes that call paid APIs are rate-limited per IP and fall back to cached or sample output on failure.

### The Railway worker

`worker/` is a standalone Node service (its own `package.json`, deployed separately on Railway with root directory `worker/`). It refreshes a competitor-ad watchlist on an interval, the durable, long-running workload that doesn't fit serverless. See `worker/README.md`. It needs `APIFY_TOKEN`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY`. The watchlist and cadence are configurable through `WATCHLIST` and `REFRESH_INTERVAL_MINUTES`.
