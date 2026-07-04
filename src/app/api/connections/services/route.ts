import {
  connectionCookie,
  getConnections,
  type ServiceKeys,
} from "@/lib/connections/store";
import { getMode } from "@/lib/connections/mode";
import { clientKey, rateLimit } from "@/lib/ratelimit";

/**
 * Bring-your-own-key for the live services (Anthropic / Apify / Firecrawl).
 * Each provided key is validated against its API, then stored only in the
 * visitor's encrypted httpOnly cookie. Visitor keys take precedence over the
 * deployment's env keys for that visitor's requests.
 */

async function validateAnthropic(key: string): Promise<void> {
  const res = await fetch("https://api.anthropic.com/v1/models?limit=1", {
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Anthropic rejected the key (${res.status})`);
}

async function validateApify(token: string): Promise<void> {
  const res = await fetch(`https://api.apify.com/v2/users/me?token=${encodeURIComponent(token)}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Apify rejected the token (${res.status})`);
}

async function validateFirecrawl(key: string): Promise<void> {
  const res = await fetch("https://api.firecrawl.dev/v1/team/credit-usage", {
    headers: { authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(`Firecrawl rejected the key (${res.status})`);
  }
  // other statuses (endpoint drift) — accept; the scrape call is the real test
}

export async function POST(req: Request) {
  if ((await getMode()) === "seeded") {
    return Response.json(
      { error: "Switch to the Live board (top toggle) to add your own keys." },
      { status: 409 },
    );
  }

  const limit = rateLimit(`svc:${clientKey(req)}`, { capacity: 6, refillPerMinute: 2 });
  if (!limit.ok) {
    return Response.json({ error: "Rate limited — try again shortly." }, { status: 429 });
  }

  let body: { anthropicKey?: string; apifyToken?: string; firecrawlKey?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const updates: ServiceKeys = {};
  try {
    if (body.anthropicKey?.trim()) {
      const k = body.anthropicKey.trim();
      if (k.length < 20) throw new Error("Anthropic key looks too short");
      await validateAnthropic(k);
      updates.anthropicKey = k;
    }
    if (body.apifyToken?.trim()) {
      const k = body.apifyToken.trim();
      if (k.length < 10) throw new Error("Apify token looks too short");
      await validateApify(k);
      updates.apifyToken = k;
    }
    if (body.firecrawlKey?.trim()) {
      const k = body.firecrawlKey.trim();
      if (k.length < 10) throw new Error("Firecrawl key looks too short");
      await validateFirecrawl(k);
      updates.firecrawlKey = k;
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Key validation failed" },
      { status: 401 },
    );
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "Provide at least one key" }, { status: 400 });
  }

  const connections = await getConnections();
  connections.services = { ...connections.services, ...updates };

  const res = Response.json({ ok: true, saved: Object.keys(updates) });
  const cookie = connectionCookie(connections);
  res.headers.set(
    "set-cookie",
    `${cookie.name}=${cookie.value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${cookie.maxAge}`,
  );
  return res;
}

export async function DELETE() {
  const connections = await getConnections();
  delete connections.services;
  const res = Response.json({ ok: true });
  const cookie = connectionCookie(connections);
  res.headers.set(
    "set-cookie",
    `${cookie.name}=${cookie.value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${cookie.maxAge}`,
  );
  return res;
}
