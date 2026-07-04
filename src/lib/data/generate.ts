/**
 * Deterministic demo dataset generator.
 *
 * Produces 90 days of campaign-level delivery data for 30 affiliate campaigns
 * across Google, Meta, Taboola, and TikTok. A fixed PRNG seed makes the output
 * identical on every run — the dataset is code, not a fixture file.
 *
 * The data is not uniform noise: several campaigns carry "planted stories"
 * (creative fatigue, CPC inflation, an under-scaled winner, a viral spike that
 * burned out, a dayparting opportunity) so the analytics and AI layers have
 * real signals to find.
 */

import type {
  Ad,
  AdFormat,
  Campaign,
  CampaignStatus,
  DailyMetric,
  Platform,
  Vertical,
} from "@/lib/adapters/types";

/** Last date in the dataset (inclusive). Aggregations treat this as "today". */
export const DATASET_END = "2026-07-04";
export const DATASET_DAYS = 90;

// ---------------------------------------------------------------------------
// PRNG — mulberry32, seeded once so every import sees the same world.
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Campaign roster
// ---------------------------------------------------------------------------

/**
 * Story modifiers receive the day index (0 = oldest, DATASET_DAYS-1 = newest)
 * and the day-of-week, and scale that day's economics.
 */
interface DayMods {
  spend: number;
  cpc: number;
  ctr: number;
  cvr: number;
}

interface CampaignSpec {
  id: string;
  platform: Platform;
  name: string;
  vertical: Exclude<Vertical, "other">;
  objective: string;
  status: CampaignStatus;
  /** average daily spend at steady state, USD */
  baseSpend: number;
  baseCpc: number;
  baseCtr: number;
  /** click → lead rate */
  baseCvr: number;
  /** affiliate payout per lead, USD */
  payout: number;
  /** day index the campaign starts delivering (0 = window start) */
  startDay?: number;
  /** day index a paused campaign stops delivering */
  endDay?: number;
  story?: (dayIndex: number, dayOfWeek: number) => Partial<DayMods>;
}

const LAST = DATASET_DAYS - 1;

/** Linear 0→1 progress over the last `n` days of the window. */
const lastDays = (i: number, n: number) => Math.max(0, i - (LAST - n)) / n;

const SPECS: CampaignSpec[] = [
  // ---- Google (search intent: low CTR base is impression-share driven) ----
  {
    id: "g-auto-ins",
    platform: "google",
    name: "Search_AutoIns_HighIntent_US",
    vertical: "insurance",
    objective: "Leads",
    status: "active",
    baseSpend: 620,
    baseCpc: 8.4,
    baseCtr: 0.062,
    baseCvr: 0.24,
    payout: 52,
    // STORY 3: auction pressure — CPC climbs ~50% across the last 30 days.
    story: (i) => ({ cpc: 1 + 0.5 * lastDays(i, 30) }),
  },
  {
    id: "g-medicare",
    platform: "google",
    name: "Search_Medicare_T65_Exact",
    vertical: "insurance",
    objective: "Calls",
    status: "active",
    baseSpend: 480,
    baseCpc: 11.2,
    baseCtr: 0.071,
    baseCvr: 0.30,
    payout: 68,
  },
  {
    id: "g-home-warranty",
    platform: "google",
    name: "PMax_HomeWarranty_Feed",
    vertical: "home-services",
    objective: "Leads",
    status: "active",
    baseSpend: 350,
    baseCpc: 3.1,
    baseCtr: 0.021,
    baseCvr: 0.12,
    payout: 34,
  },
  {
    id: "g-solar",
    platform: "google",
    name: "Search_Solar_ZIP_Broad",
    vertical: "home-services",
    objective: "Leads",
    status: "active",
    baseSpend: 410,
    baseCpc: 6.8,
    baseCtr: 0.048,
    baseCvr: 0.195,
    payout: 47,
    // STORY 5: weekend CVR runs ~35% hotter — dayparting/bid-schedule play.
    story: (_i, dow) => ({ cvr: dow === 0 || dow === 6 ? 1.35 : 0.97 }),
  },
  {
    id: "g-debt",
    platform: "google",
    name: "Search_DebtRelief_Branded",
    vertical: "finance",
    objective: "Leads",
    status: "active",
    baseSpend: 290,
    baseCpc: 5.2,
    baseCtr: 0.081,
    baseCvr: 0.125,
    payout: 71,
  },
  {
    id: "g-glp1",
    platform: "google",
    name: "Search_GLP1_Telehealth_Phrase",
    vertical: "health",
    objective: "Signups",
    status: "active",
    baseSpend: 380,
    baseCpc: 7.6,
    baseCtr: 0.055,
    baseCvr: 0.13,
    payout: 82,
  },
  {
    id: "g-roofing",
    platform: "google",
    name: "Search_Roofing_Local_CA",
    vertical: "home-services",
    objective: "Calls",
    status: "active",
    baseSpend: 210,
    baseCpc: 9.8,
    baseCtr: 0.044,
    baseCvr: 0.17,
    payout: 41,
  },
  {
    id: "g-pest",
    platform: "google",
    name: "Search_PestControl_Metro",
    vertical: "home-services",
    objective: "Calls",
    status: "paused",
    baseSpend: 180,
    baseCpc: 7.1,
    baseCtr: 0.05,
    baseCvr: 0.16,
    payout: 29,
    endDay: 38,
  },

  // ---- Meta (social: higher CTR, cheaper clicks) ----
  {
    id: "m-glp1-ugc",
    platform: "meta",
    name: "GLP1_UGC_Testimonials_ASC",
    vertical: "health",
    objective: "Leads",
    status: "active",
    baseSpend: 740,
    baseCpc: 1.9,
    baseCtr: 0.018,
    baseCvr: 0.031,
    payout: 82,
    // STORY 1: creative fatigue — CTR decays ~40% over the final 3 weeks.
    // Meta sells impressions, so as CTR falls the effective CPC climbs.
    story: (i) => {
      const t = lastDays(i, 21);
      const ctr = 1 - 0.4 * t;
      return { ctr, cpc: 1 / Math.pow(ctr, 0.85) };
    },
  },
  {
    id: "m-home-sec",
    platform: "meta",
    name: "HomeSec_Statics_Broad_US",
    vertical: "home-services",
    objective: "Leads",
    status: "active",
    baseSpend: 520,
    baseCpc: 1.55,
    baseCtr: 0.021,
    baseCvr: 0.055,
    payout: 44,
  },
  {
    id: "m-medicare",
    platform: "meta",
    name: "Medicare_Advantage_Lookalike",
    vertical: "insurance",
    objective: "Leads",
    status: "active",
    baseSpend: 430,
    baseCpc: 2.4,
    baseCtr: 0.015,
    baseCvr: 0.041,
    payout: 68,
  },
  {
    id: "m-solar-video",
    platform: "meta",
    name: "Solar_VideoHooks_ASC",
    vertical: "home-services",
    objective: "Leads",
    status: "active",
    baseSpend: 460,
    baseCpc: 1.7,
    baseCtr: 0.024,
    baseCvr: 0.054,
    payout: 47,
  },
  {
    id: "m-debt-ugc",
    platform: "meta",
    name: "DebtRelief_UGC_Duet",
    vertical: "finance",
    objective: "Leads",
    status: "active",
    baseSpend: 260,
    baseCpc: 2.1,
    baseCtr: 0.016,
    baseCvr: 0.022,
    payout: 71,
    startDay: 22,
  },
  {
    id: "m-auto-ins",
    platform: "meta",
    name: "AutoIns_CarouselQuotes",
    vertical: "insurance",
    objective: "Leads",
    status: "active",
    baseSpend: 340,
    baseCpc: 2.0,
    baseCtr: 0.014,
    baseCvr: 0.042,
    payout: 52,
  },
  {
    id: "m-hair",
    platform: "meta",
    name: "HairLoss_Telehealth_Statics",
    vertical: "health",
    objective: "Signups",
    status: "active",
    baseSpend: 300,
    baseCpc: 1.6,
    baseCtr: 0.023,
    baseCvr: 0.052,
    payout: 58,
  },
  {
    id: "m-retarg",
    platform: "meta",
    name: "HomeSvc_LeadReheat_DPA",
    vertical: "home-services",
    objective: "Leads",
    status: "active",
    baseSpend: 120,
    baseCpc: 0.95,
    baseCtr: 0.034,
    baseCvr: 0.066,
    payout: 40,
  },
  {
    id: "m-hvac",
    platform: "meta",
    name: "HVAC_Seasonal_Statics",
    vertical: "home-services",
    objective: "Leads",
    status: "paused",
    baseSpend: 240,
    baseCpc: 1.8,
    baseCtr: 0.017,
    baseCvr: 0.024,
    payout: 38,
    endDay: 55,
  },

  // ---- Taboola (native: cheap clicks, long-tail CVR) ----
  {
    id: "t-home-warranty",
    platform: "taboola",
    name: "Native_HomeWarranty_Advertorial_D",
    vertical: "home-services",
    objective: "Leads",
    status: "active",
    baseSpend: 450,
    baseCpc: 0.62,
    baseCtr: 0.0042,
    baseCvr: 0.035,
    payout: 34,
    // STORY 2: the quiet winner — ROAS ≈ 3.2 on flat spend. Nothing decays,
    // nothing spikes; the signal is that nobody has scaled it.
    story: () => ({ cvr: 1.65 }),
  },
  {
    id: "t-glp1",
    platform: "taboola",
    name: "Native_GLP1_Advertorial_A",
    vertical: "health",
    objective: "Signups",
    status: "active",
    baseSpend: 380,
    baseCpc: 0.71,
    baseCtr: 0.0038,
    baseCvr: 0.011,
    payout: 82,
  },
  {
    id: "t-medicare",
    platform: "taboola",
    name: "Native_Medicare_Listicle",
    vertical: "insurance",
    objective: "Leads",
    status: "active",
    baseSpend: 290,
    baseCpc: 0.58,
    baseCtr: 0.0035,
    baseCvr: 0.0085,
    payout: 68,
  },
  {
    id: "t-debt",
    platform: "taboola",
    name: "Native_DebtRelief_Quiz",
    vertical: "finance",
    objective: "Leads",
    status: "active",
    baseSpend: 310,
    baseCpc: 0.66,
    baseCtr: 0.004,
    baseCvr: 0.0135,
    payout: 71,
  },
  {
    id: "t-solar",
    platform: "taboola",
    name: "Native_Solar_Calculator",
    vertical: "home-services",
    objective: "Leads",
    status: "active",
    baseSpend: 220,
    baseCpc: 0.6,
    baseCtr: 0.0036,
    baseCvr: 0.0115,
    payout: 47,
  },
  {
    id: "t-roof",
    platform: "taboola",
    name: "Native_Roofing_Advertorial",
    vertical: "home-services",
    objective: "Leads",
    status: "paused",
    baseSpend: 150,
    baseCpc: 0.64,
    baseCtr: 0.0033,
    baseCvr: 0.007,
    payout: 41,
    endDay: 30,
  },

  // ---- TikTok (short-form: volatile, creative-driven) ----
  {
    id: "tt-glp1-viral",
    platform: "tiktok",
    name: "GLP1_HookLab_Spark",
    vertical: "health",
    objective: "Signups",
    status: "active",
    baseSpend: 260,
    baseCpc: 1.25,
    baseCtr: 0.011,
    baseCvr: 0.021,
    payout: 82,
    // STORY 4: a hook went viral around day 35–48, spend was chased up 4x,
    // then the creative burned out and never recovered.
    story: (i) => {
      if (i >= 35 && i <= 48) {
        const peak = 1 - Math.abs(i - 41.5) / 6.5; // triangle ramp
        return { spend: 1 + 3 * peak, ctr: 1 + 1.6 * peak, cvr: 1 + 0.4 * peak };
      }
      if (i > 48) return { spend: 0.45, ctr: 0.55, cvr: 0.8 };
      return {};
    },
  },
  {
    id: "tt-home-sec",
    platform: "tiktok",
    name: "HomeSec_POV_Hooks",
    vertical: "home-services",
    objective: "Leads",
    status: "active",
    baseSpend: 310,
    baseCpc: 1.1,
    baseCtr: 0.013,
    baseCvr: 0.034,
    payout: 44,
  },
  {
    id: "tt-hair",
    platform: "tiktok",
    name: "HairLoss_BeforeAfter",
    vertical: "health",
    objective: "Signups",
    status: "active",
    baseSpend: 280,
    baseCpc: 1.05,
    baseCtr: 0.015,
    baseCvr: 0.028,
    payout: 58,
  },
  {
    id: "tt-debt",
    platform: "tiktok",
    name: "DebtRelief_GreenScreen",
    vertical: "finance",
    objective: "Leads",
    status: "active",
    baseSpend: 230,
    baseCpc: 1.3,
    baseCtr: 0.012,
    baseCvr: 0.019,
    payout: 71,
    startDay: 14,
  },
  {
    id: "tt-auto-ins",
    platform: "tiktok",
    name: "AutoIns_QuoteChallenge",
    vertical: "insurance",
    objective: "Leads",
    status: "active",
    baseSpend: 190,
    baseCpc: 1.45,
    baseCtr: 0.01,
    baseCvr: 0.022,
    payout: 52,
  },
  {
    id: "tt-solar",
    platform: "tiktok",
    name: "Solar_DuetChain",
    vertical: "home-services",
    objective: "Leads",
    status: "active",
    baseSpend: 240,
    baseCpc: 1.15,
    baseCtr: 0.013,
    baseCvr: 0.030,
    payout: 47,
  },
  {
    id: "tt-medicare",
    platform: "tiktok",
    name: "Medicare_Explainer_Spark",
    vertical: "insurance",
    objective: "Leads",
    status: "paused",
    baseSpend: 170,
    baseCpc: 1.6,
    baseCtr: 0.009,
    baseCvr: 0.013,
    payout: 68,
    endDay: 47,
  },
];

// ---------------------------------------------------------------------------
// Ad creative pools (per vertical) for ad-level rows
// ---------------------------------------------------------------------------

const HOOKS: Record<Exclude<Vertical, "other">, string[]> = {
  "home-services": [
    "Homeowners are switching in droves — here's why",
    "The $1 trick contractors don't want you to know",
    "POV: your neighbor's bill is half of yours",
    "We compared every provider so you don't have to",
  ],
  insurance: [
    "Drivers over 40 are overpaying by $700/yr",
    "New rule means you may qualify for extra benefits",
    "I asked 3 agents the same question…",
    "Your zip code decides your rate — check yours",
  ],
  health: [
    "I tried it for 30 days — honest results",
    "Doctors explain why this finally works",
    "The before/after nobody expected",
    "Why everyone's talking about this program",
  ],
  finance: [
    "One call cut my payment by 40%",
    "If you owe more than $10k, read this",
    "The loophole banks hope you miss",
    "How I got debt-free before 35",
  ],
};

const HEADLINES: Record<Exclude<Vertical, "other">, string[]> = {
  "home-services": [
    "Get a Free Quote in 60 Seconds",
    "Compare Local Pros Instantly",
    "See If Your Home Qualifies",
    "Lock In 2026 Pricing Today",
  ],
  insurance: [
    "Check Your New Rate in 2 Min",
    "See Plans You May Qualify For",
    "Compare Quotes Side-by-Side",
    "Find Out What You're Owed",
  ],
  health: [
    "Take the 60-Second Quiz",
    "See If You Qualify Online",
    "Start Your Plan Today",
    "Get Matched With a Provider",
  ],
  finance: [
    "See Your Options — Free",
    "Check Eligibility in Minutes",
    "Get Your Custom Plan",
    "Talk to a Specialist Today",
  ],
};

const FORMAT_BY_PLATFORM: Record<Platform, AdFormat[]> = {
  google: ["search", "search", "image"],
  meta: ["image", "video", "image", "video"],
  taboola: ["native", "native", "native"],
  tiktok: ["video", "video", "video"],
};

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export interface Dataset {
  campaigns: Campaign[];
  metrics: DailyMetric[];
  ads: Ad[];
  start: string;
  end: string;
}

function isoDaysBefore(endIso: string, days: number): string {
  const d = new Date(`${endIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function generate(): Dataset {
  const rand = mulberry32(0x17_0d_a7_a5);
  const noise = (spread: number) => 1 + (rand() * 2 - 1) * spread;

  const campaigns: Campaign[] = [];
  const metrics: DailyMetric[] = [];
  const ads: Ad[] = [];

  for (const spec of SPECS) {
    const startDay = spec.startDay ?? 0;
    const endDay = spec.endDay ?? LAST;

    campaigns.push({
      id: spec.id,
      platform: spec.platform,
      name: spec.name,
      vertical: spec.vertical,
      status: spec.status,
      objective: spec.objective,
      dailyBudget: Math.round(spec.baseSpend * 1.15),
      launchedAt: isoDaysBefore(DATASET_END, LAST - startDay),
    });

    // campaign totals accumulated for ad-level splits
    let tSpend = 0,
      tRev = 0,
      tImp = 0,
      tClicks = 0,
      tConv = 0;

    for (let i = 0; i < DATASET_DAYS; i++) {
      if (i < startDay || i > endDay) continue;

      const date = isoDaysBefore(DATASET_END, LAST - i);
      const dow = new Date(`${date}T00:00:00Z`).getUTCDay();

      const mods = { spend: 1, cpc: 1, ctr: 1, cvr: 1, ...spec.story?.(i, dow) };

      // Mild vertical seasonality: insurance/finance skew weekday,
      // home-services skews weekend browsing.
      const weekend = dow === 0 || dow === 6;
      const seasonal =
        spec.vertical === "insurance" || spec.vertical === "finance"
          ? weekend
            ? 0.88
            : 1.04
          : weekend
            ? 1.06
            : 0.98;

      // Ramp new campaigns in over their first week.
      const ramp = Math.min(1, (i - startDay + 1) / 7);

      const spend = spec.baseSpend * mods.spend * seasonal * ramp * noise(0.12);
      const cpc = spec.baseCpc * mods.cpc * noise(0.08);
      const ctr = spec.baseCtr * mods.ctr * noise(0.1);
      const cvr = spec.baseCvr * mods.cvr * noise(0.15);

      const clicks = spend / cpc;
      const impressions = clicks / ctr;
      const conversions = clicks * cvr;
      const revenue = conversions * spec.payout * noise(0.05);

      const row: DailyMetric = {
        date,
        campaignId: spec.id,
        spend: round2(spend),
        revenue: round2(revenue),
        impressions: Math.round(impressions),
        clicks: Math.round(clicks),
        conversions: Math.round(conversions * 10) / 10,
      };
      metrics.push(row);

      tSpend += row.spend;
      tRev += row.revenue;
      tImp += row.impressions;
      tClicks += row.clicks;
      tConv += row.conversions;
    }

    // Split campaign totals across 2–4 ads with a dominant creative.
    const adCount = 2 + Math.floor(rand() * 3);
    const weights = Array.from({ length: adCount }, () => 0.5 + rand());
    const wSum = weights.reduce((a, b) => a + b, 0);
    const formats = FORMAT_BY_PLATFORM[spec.platform];
    const hooks = HOOKS[spec.vertical];
    const headlines = HEADLINES[spec.vertical];

    for (let a = 0; a < adCount; a++) {
      const w = weights[a] / wSum;
      // winning creatives convert better than the campaign average
      const skew = 0.85 + w * 0.6;
      ads.push({
        id: `${spec.id}-ad${a + 1}`,
        campaignId: spec.id,
        name: `${spec.name.split("_")[0]}_v${a + 1}`,
        format: formats[a % formats.length],
        headline: headlines[(a + Math.floor(rand() * 2)) % headlines.length],
        hook: hooks[(a + Math.floor(rand() * 2)) % hooks.length],
        spend: round2(tSpend * w),
        revenue: round2(tRev * w * skew),
        impressions: Math.round(tImp * w),
        clicks: Math.round(tClicks * w),
        conversions: Math.round(tConv * w * skew * 10) / 10,
      });
    }
  }

  return {
    campaigns,
    metrics,
    ads,
    start: isoDaysBefore(DATASET_END, LAST),
    end: DATASET_END,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

let cached: Dataset | null = null;

/** The demo world. Memoized; deterministic across processes and deploys. */
export function getDataset(): Dataset {
  cached ??= generate();
  return cached;
}
