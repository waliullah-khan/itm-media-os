/**
 * Ad Intelligence: research competitor ads in the Meta Ad Library for a niche
 * keyword or a brand page, analyze the creatives with Claude, and produce a
 * reproduction prompt per ad.
 *
 * This module is the native rebuild of an n8n workflow that chained
 * Apify → Gemini → Airtable → Slack. Here the same pipeline is three typed
 * functions and one API route.
 */

export type QueryKind = "keyword" | "page";

export interface ResearchRequest {
  query: string;
  kind: QueryKind;
  country: string;
  limit: number;
}

/** Normalized ad from the Apify Facebook Ads Library actor. */
export interface ScrapedAd {
  id: string;
  pageName: string;
  body: string | null;
  ctaType: string | null;
  title: string | null;
  mediaUrl: string | null;
  mediaKind: "image" | "video" | null;
  landingUrl: string | null;
  startedRunning: string | null;
  platforms: string[];
}

export interface AdAnalysis {
  adId: string;
  hook: string;
  angle: string;
  format: string;
  emotion: string;
  whyItWorks: string;
  reproductionPrompt: string;
}

export interface Research {
  query: string;
  kind: QueryKind;
  country: string;
  fetchedAt: string;
  source: "live" | "sample";
  ads: ScrapedAd[];
  analyses: AdAnalysis[];
  patterns: string[];
  recommendations: string[];
  landingPageNotes: string | null;
}
