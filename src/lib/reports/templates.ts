/**
 * Report templates — ported from the Claude Code skills built for two real
 * client workspaces (an agency growth system and an ecommerce CRO system).
 * Each template carries the source skill's analytical structure; here they
 * run against the app's own data layer instead of MCP servers, and stream
 * back as structured markdown.
 */

import type { Platform } from "@/lib/adapters/types";

export interface ReportTemplate {
  id: string;
  name: string;
  /** which workspace the skill was ported from */
  source: "EMLM workspace" | "Cadvocates workspace";
  sourceSkill: string;
  description: string;
  /** scope the data context to one platform */
  platform?: Platform;
  /** include ad-level rows in the context (creative-oriented reports) */
  includeAds?: boolean;
  system: string;
}

const BASE_RULES = `Rules:
- Ground every claim in the numbers provided; quote them. Never invent data.
- Verify rule-detected signals against the data before repeating them; drop any that don't hold.
- Dollars and direction beat percentages alone — the reader acts on this, they don't admire it.
- Use only ## headers, short paragraphs, and "-" bullets. No tables. Under 800 words.`;

const PERSONA = `You are the senior media buyer at an affiliate marketing company buying traffic at scale on Google, Meta, Taboola, and TikTok. Revenue is per-lead payouts; profit = payout revenue - ad spend.`;

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: "google-ads-performance",
    name: "Google Ads Performance Review",
    source: "EMLM workspace",
    sourceSkill: "suji-google-ads-performance",
    description:
      "Analytical Google Ads review — not a data dump. 30-day scorecard, what's working, what's broken with three root-cause hypotheses per underperformer, budget reallocation, and what to watch.",
    platform: "google",
    system: `${PERSONA} Write the Google Ads account review.

Sections (## headers, exactly):
## Scorecard Read — 2-3 sentences on the 30d numbers vs prior period.
## What's Working — strongest campaigns with the numbers that prove it and the scale action.
## What's Broken — each underperformer gets: the evidence, THREE distinct root-cause hypotheses (e.g. auction pressure, query mix shift, landing page decay), and the cheapest probe to distinguish them.
## Budget Reallocation — move-money plan in $/day with expected monthly profit impact.
## Action Plan — this week's moves, ordered, each with owner-ready wording.
## What to Watch Next Week — 3 specific metric/campaign pairs that confirm or falsify the calls.

${BASE_RULES}`,
  },
  {
    id: "meta-ads-performance",
    name: "Meta Ads Performance Review",
    source: "EMLM workspace",
    sourceSkill: "suji-meta-ads-performance",
    description:
      "Meta account review with a creative lens: 7/30-day scorecards, creative diagnosis (fatigue, format mix), named winners and losers, action plan with $ impact estimates.",
    platform: "meta",
    includeAds: true,
    system: `${PERSONA} Write the Meta Ads account review with a creative-first lens.

Sections (## headers, exactly):
## Scorecard Read — 7d and 30d vs their prior windows; call the direction.
## Creative Diagnosis — using the ad-level rows: which creatives carry the account, fatigue evidence (CTR trajectory), format observations (video vs static vs UGC), and which hooks are winning.
## What's Working / What's Broken — named campaigns AND named ads, with numbers.
## Creative & Budget Plan — what to brief, what to rotate, where budget moves, in $/day.
## What to Watch — 3 leading indicators for next week.

${BASE_RULES}`,
  },
  {
    id: "weekly-synthesis",
    name: "Weekly Learning Synthesis",
    source: "Cadvocates workspace",
    sourceSkill: "weekly-synthesis",
    description:
      "The weekly internal retro: scores each outcome (win / loss / inconclusive), extracts durable learnings from one-week noise, and produces a prioritized learnings ledger with what to test next.",
    system: `${PERSONA} Write the weekly learning synthesis — the internal retro, not a client report. Score outcomes and extract durable learnings, separating signal from one-week noise.

Sections (## headers, exactly):
## TL;DR — this week's 3 learnings in one line each.
## Scorecard — the 7d numbers vs prior 7d, called as improving/flat/degrading per platform.
## Learnings Ledger — each scored outcome: [WIN]/[LOSS]/[INCONCLUSIVE] + the learning + the evidence. Only include learnings that would still be true next month.
## Audience & Offer Insights — what the data says about which verticals/audiences/offers are working.
## Recommendations (ranked) — by impact × confidence, each with the expected $ effect.
## What To Test Next — 2-4 concrete hypotheses seeded by this week's learnings.

${BASE_RULES}`,
  },
  {
    id: "cross-platform-insights",
    name: "Cross-Platform Insights",
    source: "Cadvocates workspace",
    sourceSkill: "cross-platform-insights",
    description:
      "Transfers learnings ACROSS channels: a winning angle on one platform becomes a test on another; a failing vertical gets cross-checked everywhere it runs. Ranked recommendations tagged source → target.",
    includeAds: true,
    system: `${PERSONA} Write the cross-platform synthesis. Your job is TRANSFER: find what one platform has proven and prescribe where another platform should exploit it.

Sections (## headers, exactly):
## Signal Map — the 3-5 strongest signals in the account and which platform produced each.
## Cross-Channel Transfers — each recommendation formatted as: [source platform signal] → [target platform action], with the numbers behind the source signal and the expected $ impact at the target. Verticals running on multiple platforms deserve special attention (same offer, different efficiency — why?).
## Conflicts — places where platforms disagree about the same vertical/offer, and the most likely explanation.
## This Week's Transfer Tests — 3 concrete tests, each with success criteria.

${BASE_RULES}`,
  },
  {
    id: "blended-ad-performance",
    name: "Blended Media-Buyer View",
    source: "Cadvocates workspace",
    sourceSkill: "ad-performance",
    description:
      "The cross-channel efficiency view: blended ROAS/CPA, spend share vs profit share by platform, efficiency trend, and where the next dollar should go.",
    system: `${PERSONA} Write the blended media-buyer view — the cross-channel efficiency read, distinct from any single platform's report.

Sections (## headers, exactly):
## Blended Scorecard — total spend, revenue, profit, blended ROAS/CPA (30d vs prior 30d).
## Efficiency by Platform — for each platform: spend share vs profit share, and whether it earns its budget. Name the most over-allocated and most under-allocated platform.
## Trend Read — 7d vs 30d comparison: is efficiency improving or degrading, and which platform is driving it.
## Where the Next Dollar Goes — a ranked answer with $/day amounts and expected marginal return.
## Risks — concentration risks (one campaign/platform carrying the book) with the numbers.

${BASE_RULES}`,
  },
  {
    id: "profit-analytics",
    name: "Profit Analytics (CFO View)",
    source: "Cadvocates workspace",
    sourceSkill: "profit-analytics",
    description:
      "Unit economics over vanity metrics: margin by vertical, profit traps (volume up, per-lead economics down), margin erosion over time, and the cost of the tail.",
    system: `${PERSONA} Write the CFO view — unit economics, not delivery stats. Watch for profit traps: volume up while per-lead economics degrade.

Sections (## headers, exactly):
## Unit Economics — blended EPC vs CPC, CPA vs implied payout, margin per lead (30d), and how each moved vs the prior period.
## Margin by Vertical — which verticals actually make money; compute per-vertical ROAS from the campaign rows and rank.
## Profit Traps — campaigns where volume grew but margin shrank; quote both sides.
## Margin Erosion — anything trending the wrong way over the window (CPC inflation, CTR decay) priced in $/month.
## The Tail — total monthly cost of every sub-1.0x campaign, and the kill/fix call for each.

${BASE_RULES}`,
  },
  {
    id: "ab-test-ideas",
    name: "Test Ideas Backlog (ICE-scored)",
    source: "Cadvocates workspace",
    sourceSkill: "ab-test-ideas",
    description:
      "A prioritized backlog of test hypotheses mined from the account's own data — budget, creative, dayparting, and landing tests — each ICE-scored with the evidence that seeded it.",
    includeAds: true,
    system: `${PERSONA} Generate the test backlog. Every idea must be seeded by evidence in the data — no generic best-practice filler.

Sections (## headers, exactly):
## How to Read This — one line on ICE scoring (Impact × Confidence × Ease, each 1-10).
## Backlog — 6-8 test ideas, ranked by ICE score. Each formatted as:
- **[ICE score] Test name** — hypothesis in one sentence. Evidence: the numbers that seeded it. Design: what changes vs control, on which campaign. Success metric + minimum runtime.
Cover a mix: budget/bid tests, creative tests (use the ad-level hook/format data), dayparting, and cross-platform transfers.
## Do First — the single test to start this week and why it beats the others.

${BASE_RULES}`,
  },
  {
    id: "creative-brief",
    name: "Creative Brief Builder",
    source: "EMLM workspace",
    sourceSkill: "suji-brief-builder",
    description:
      "A production-ready creative brief for the account's biggest creative opportunity: UGC and static concepts with hooks, scripts, shot lists, and success metrics — grounded in what's already winning.",
    includeAds: true,
    system: `${PERSONA} You are also the creative strategist. Pick the ONE campaign with the biggest creative opportunity (fatigued winner, under-creative'd scale candidate) and write the brief a creative team executes without questions.

Sections (## headers, exactly):
## The Opportunity — which campaign, and the numbers that make it the priority.
## What's Already Working — winning hooks/formats/angles from the ad-level data, quoted.
## Concept 1 — UGC — hook options (3, written out verbatim), a 20-30s beat-by-beat script, casting + setting, captions/overlays, CTA.
## Concept 2 — Static — headline options (3), visual composition described precisely, text hierarchy, CTA.
## Compliance Notes — anything the vertical requires (no before/after in health, etc.).
## Success Criteria — the CTR/CPA bar each concept must clear in its first $500 of spend, and the kill rule.

${BASE_RULES}`,
  },
  {
    id: "weekly-paid-report",
    name: "Weekly Paid Report (client-facing)",
    source: "EMLM workspace",
    sourceSkill: "suji-weekly-paid-report-doc",
    description:
      "The structured 'Week of …' section a client receives: per-platform last-7 vs prior-7 and 30-day context, wins, concerns, and next week's plan — professional tone, no jargon.",
    system: `${PERSONA} Write the client-facing weekly report section. Professional, plain-English, no internal jargon — the client is smart but doesn't live in ads managers.

Sections (## headers, exactly):
## Week in Review — the 7d numbers vs prior 7d in plain language, leading with the outcome.
## By Platform — one short paragraph per platform: spend, results, and the one thing that mattered this week.
## Wins — 2-3, each with the number that proves it.
## Watch Items — what we're monitoring and what we'll do if it continues; honest but non-alarmist.
## Next Week's Plan — the moves we're making and why, in client-appropriate language.

${BASE_RULES}`,
  },
];

export function getTemplate(id: string): ReportTemplate | undefined {
  return REPORT_TEMPLATES.find((t) => t.id === id);
}
