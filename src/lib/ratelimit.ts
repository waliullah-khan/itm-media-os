/**
 * In-memory token bucket keyed by IP — protects the live AI/scrape routes on
 * an open demo. Serverless instances each get their own bucket, which is
 * acceptable for demo-scale traffic; production would use a shared store.
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  { capacity = 5, refillPerMinute = 2 } = {},
): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: capacity, lastRefill: now };

  const elapsedMin = (now - bucket.lastRefill) / 60_000;
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsedMin * refillPerMinute);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return { ok: false, retryAfterSec: Math.ceil((1 - bucket.tokens) / (refillPerMinute / 60)) };
  }

  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return { ok: true };
}

export function clientKey(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous"
  );
}
