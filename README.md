# Media Buying OS

A command center for a media buying team that runs paid traffic at scale on **Google, Meta, Taboola, and TikTok** — cross-platform reporting, an AI analyst that writes the weekly review, competitor ad intelligence with reproduction prompts, a rules engine with human-in-the-loop approvals, and a marginal-ROAS budget planner. One app, one repo, live on Vercel.

Built for the It's Today Media build contest.

---

## What does this tool do?

**Command Center** (`/`) — every platform in one view: spend, revenue, profit, blended ROAS/CPA with period-over-period deltas, a 90-day trend, platform breakdown, top/bottom campaigns, and rule-detected signals (creative fatigue, CPC inflation, under-scaled winners, dayparting opportunities). Click through to any campaign for its trend and ad-level performance.

**AI Analyst** (`/analyst`) — one click and Claude reads the same rollups the dashboard renders and streams the review a senior buyer would spend an hour writing: verdict, what's working, what's broken *with root-cause hypotheses*, a move-money plan in dollars, and what to watch next week. Grounded in the account's actual numbers — never a generic essay.

**Ad Intelligence** (`/intelligence`) — type a niche ("home security") or a brand page. The Meta Ad Library is scraped live (Apify), the top ad's landing page is pulled for funnel context (Firecrawl), and Claude reverse-engineers every creative: hook, angle, format, emotion, why it works — plus a **reproduction prompt** your creative team (or an image/video model) can execute directly. Ships with sample researches so it demos instantly; a scheduled Vercel cron refreshes a watchlist weekly.

**Automation Studio** (`/automations`) — declarative rules over rolling windows ("pause if CPA > $70 over 4 days", "scale +20% if ROAS > 2.0 for a week", "alert on CTR −20% vs prior 3 weeks"). Every triggered action lands in a **pending queue with its evidence and an estimated monthly $ impact** — including a negative estimate when the rule fires on a campaign that's still profitable, which is exactly why nothing executes without a human clicking Approve. Build and evaluate your own rule live.

**Media Planner** (`/planner`) — every campaign gets a diminishing-returns curve fit on its trailing 14 days; drag one slider and the total budget re-allocates by *marginal* ROAS with projected revenue, profit, and leads. Answers the question a budget meeting actually asks: "if we had $2K/day more (or less), where does it go?"

**Connections** (`/connections`) — the honest architecture page: which data is seeded demo data, which services are live (Anthropic, Apify, Firecrawl, cron), and what a production integration of each ad platform needs.

### How it's wired

```
src/lib/adapters/     PlatformAdapter interface + registry — swap seeded → live per platform
src/lib/data/         deterministic dataset generator (planted stories) + pure aggregation
src/lib/analyst/      context assembly + prompt + streamed Claude review
src/lib/intelligence/ Apify ad-library client + Firecrawl + Claude structured analysis
src/lib/automations/  rules engine → pending actions (tested)
src/lib/planner/      curve fitting + greedy marginal-ROAS allocation
src/app/              Next.js App Router pages + API routes
```

The four ad platforms are served by a **seeded adapter** behind the same `PlatformAdapter` interface a live integration implements. The demo dataset is generated, not hand-written: a fixed-seed PRNG produces 90 days × 30 campaigns of affiliate-economics data (payout revenue, EPC, CPA) with **planted stories** — a fatiguing Meta UGC creative, a Google campaign under auction pressure, a Taboola winner nobody scaled, a TikTok viral spike that burned out, a weekend-CVR pattern — so the analytics, AI, and automations have real signals to find, and you can verify they find them.

Everything live (Claude, Apify, Firecrawl) degrades gracefully: no key → clearly-labeled cached/sample output. The demo never white-screens.

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

1. **Live platform adapters.** Google Ads first (API + OAuth are the most standardized), then Meta, TikTok, Taboola. The interface already exists; each adapter is a contained integration. Real accounts flow into every module on day one.
2. **Persistence + multi-user.** Postgres (Drizzle) for scrape history, automation audit logs, approved-action records, and saved plans; auth for the team.
3. **Close the automation loop.** Approved actions actually push: paused status and budget changes via each platform's API, with dry-run mode, change history, and one-click rollback — the same draft-first philosophy, now with teeth.
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

Optional env (`.env.local`) to light up the live features:

| Variable | Enables |
|---|---|
| `ANTHROPIC_API_KEY` | Live AI Analyst + live creative analysis |
| `APIFY_TOKEN` | Live Meta Ad Library scraping |
| `FIRECRAWL_API_KEY` | Landing-page funnel notes |
| `CRON_SECRET` | The scheduled ad-library refresh route |
| `ANALYST_MODEL` | Override the Claude model (default `claude-sonnet-5`) |

Deployed on Vercel; `vercel.json` schedules the weekly intelligence refresh. Open routes that call paid APIs are rate-limited per IP and fall back to cached output on failure.
