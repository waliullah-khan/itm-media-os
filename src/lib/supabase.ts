/**
 * Minimal Supabase REST (PostgREST) client — one table, two operations.
 * No SDK dependency; the anon key is scoped by RLS to select/insert on
 * research_runs only. Absent env vars degrade to no-ops so the app runs
 * without Supabase configured.
 */

import type { Research } from "@/lib/intelligence/types";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY;

function headers(): Record<string, string> {
  return {
    apikey: KEY!,
    authorization: `Bearer ${KEY}`,
    "content-type": "application/json",
  };
}

export function supabaseConfigured(): boolean {
  return Boolean(URL && KEY);
}

export async function saveResearch(
  runId: string,
  research: Research,
  source: "live" | "watchlist" = "live",
): Promise<void> {
  if (!supabaseConfigured()) return;
  try {
    await fetch(`${URL}/rest/v1/research_runs`, {
      method: "POST",
      headers: { ...headers(), prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({
        run_id: runId,
        query: research.query,
        kind: research.kind,
        country: research.country,
        source,
        ads_count: research.ads.length,
        payload: research,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    // persistence is best-effort — never fail the user-facing request
    console.error("supabase saveResearch failed:", err);
  }
}

export async function getResearchByRunId(runId: string): Promise<Research | null> {
  if (!supabaseConfigured()) return null;
  try {
    const res = await fetch(
      `${URL}/rest/v1/research_runs?run_id=eq.${encodeURIComponent(runId)}&select=payload&limit=1`,
      { headers: headers(), signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { payload: Research }[];
    return rows[0]?.payload ?? null;
  } catch {
    return null;
  }
}

export interface RecentResearch {
  runId: string;
  query: string;
  kind: "keyword" | "page";
  country: string;
  source: string;
  adsCount: number;
  createdAt: string;
}

export async function listRecentResearches(limit = 8): Promise<RecentResearch[]> {
  if (!supabaseConfigured()) return [];
  try {
    const res = await fetch(
      `${URL}/rest/v1/research_runs?select=run_id,query,kind,country,source,ads_count,created_at&order=created_at.desc&limit=${limit}`,
      { headers: headers(), signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as {
      run_id: string;
      query: string;
      kind: "keyword" | "page";
      country: string;
      source: string;
      ads_count: number;
      created_at: string;
    }[];
    return rows.map((r) => ({
      runId: r.run_id,
      query: r.query,
      kind: r.kind,
      country: r.country,
      source: r.source,
      adsCount: r.ads_count,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}
