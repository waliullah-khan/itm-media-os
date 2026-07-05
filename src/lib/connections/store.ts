/**
 * Per-visitor connection store: platform credentials live in an encrypted,
 * httpOnly cookie — no database, nothing shared between visitors, nothing
 * persisted server-side. AES-256-GCM via Node crypto.
 *
 * The cookie key derives from CONNECTIONS_SECRET (set in the deployment);
 * without it a process-local fallback is used, which is fine for local dev.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export const CONNECTIONS_COOKIE = "mbos_connections";

export interface MetaConnection {
  accessToken: string;
  /** with the act_ prefix */
  accountId: string;
  accountName: string;
  connectedAt: string;
}

export interface GoogleAdsConnection {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** 10-digit customer id, no dashes */
  customerId: string;
  /** manager (MCC) id when auth runs through one */
  loginCustomerId?: string;
  accountName: string;
  connectedAt: string;
}

export interface TikTokConnection {
  accessToken: string;
  advertiserId: string;
  accountName: string;
  connectedAt: string;
}

export interface TaboolaConnection {
  clientId: string;
  clientSecret: string;
  accountId: string;
  accountName: string;
  connectedAt: string;
}

/** Visitor-supplied service keys — used in place of the deployment's env
 * keys so anyone can run the live AI/scraping features on their own quota. */
export interface ServiceKeys {
  anthropicKey?: string;
  apifyToken?: string;
  firecrawlKey?: string;
}

export interface Connections {
  meta?: MetaConnection;
  google?: GoogleAdsConnection;
  tiktok?: TikTokConnection;
  taboola?: TaboolaConnection;
  services?: ServiceKeys;
}

/**
 * Effective service keys.
 *
 * `allowEnvFallback` controls whether the deployment's own keys may be used
 * when the visitor hasn't supplied their own:
 *  - SEEDED board → true: the demo's AI/scraping runs on the deployment keys.
 *  - LIVE board   → false: a visitor's live-account features run ONLY on the
 *    visitor's own keys. The deployment keys are never used for live-board
 *    data, so no one runs live AI/scraping on the owner's quota.
 *
 * Defaults to `false` (fail-safe: never leak the deployment keys unless a
 * caller explicitly opts in for the seeded demo).
 */
export function resolveServiceKeys(
  connections: Connections,
  { allowEnvFallback = false }: { allowEnvFallback?: boolean } = {},
): {
  anthropic?: string;
  apify?: string;
  firecrawl?: string;
} {
  const v = connections.services;
  if (allowEnvFallback) {
    return {
      anthropic: v?.anthropicKey ?? process.env.ANTHROPIC_API_KEY,
      apify: v?.apifyToken ?? process.env.APIFY_TOKEN,
      firecrawl: v?.firecrawlKey ?? process.env.FIRECRAWL_API_KEY,
    };
  }
  return {
    anthropic: v?.anthropicKey,
    apify: v?.apifyToken,
    firecrawl: v?.firecrawlKey,
  };
}

function key(): Buffer {
  const secret =
    process.env.CONNECTIONS_SECRET ?? process.env.CRON_SECRET ?? "mbos-dev-only-fallback";
  return createHash("sha256").update(secret).digest();
}

export function encryptConnections(data: Connections): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

export function decryptConnections(token: string): Connections {
  try {
    const raw = Buffer.from(token, "base64url");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plain.toString("utf8")) as Connections;
  } catch {
    // wrong key (secret rotated) or tampered cookie — treat as no connections
    return {};
  }
}

/** Read the current visitor's connections (server components / routes). */
export async function getConnections(): Promise<Connections> {
  const jar = await cookies();
  const token = jar.get(CONNECTIONS_COOKIE)?.value;
  return token ? decryptConnections(token) : {};
}

export function connectionCookie(data: Connections) {
  return {
    name: CONNECTIONS_COOKIE,
    value: encryptConnections(data),
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}
