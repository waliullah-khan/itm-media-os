/**
 * Platform adapter layer.
 *
 * Every ad platform (live or seeded) is exposed to the app through the same
 * `PlatformAdapter` interface. The demo registers four seeded adapters; a real
 * deployment swaps any of them for an API-backed implementation without
 * touching the UI or analytics code.
 */

export type Platform = "google" | "meta" | "taboola" | "tiktok";

export const PLATFORMS: Platform[] = ["google", "meta", "taboola", "tiktok"];

export const PLATFORM_LABELS: Record<Platform, string> = {
  google: "Google Ads",
  meta: "Meta",
  taboola: "Taboola",
  tiktok: "TikTok",
};

export type Vertical = "home-services" | "insurance" | "health" | "finance";

export const VERTICAL_LABELS: Record<Vertical, string> = {
  "home-services": "Home Services",
  insurance: "Insurance",
  health: "Health",
  finance: "Finance",
};

export type CampaignStatus = "active" | "paused";

export type AdFormat = "image" | "video" | "native" | "search";

export interface Campaign {
  id: string;
  platform: Platform;
  name: string;
  vertical: Vertical;
  status: CampaignStatus;
  objective: string;
  /** USD */
  dailyBudget: number;
  /** ISO date the campaign started delivering */
  launchedAt: string;
}

/** One campaign-day of raw delivery data (revenue = affiliate payout). */
export interface DailyMetric {
  date: string;
  campaignId: string;
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

/** Per-ad lifetime totals within the dataset window. */
export interface Ad {
  id: string;
  campaignId: string;
  name: string;
  format: AdFormat;
  headline: string;
  hook: string;
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface DateRange {
  /** inclusive ISO dates */
  from: string;
  to: string;
}

export interface PlatformAdapter {
  platform: Platform;
  /** "seeded" adapters serve the demo dataset; "live" ones call real APIs. */
  mode: "seeded" | "live";
  getCampaigns(): Promise<Campaign[]>;
  getDailyMetrics(range: DateRange, campaignId?: string): Promise<DailyMetric[]>;
  getAds(campaignId: string): Promise<Ad[]>;
}
