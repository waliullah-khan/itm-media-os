import { validateMetaConnection } from "@/lib/adapters/meta-live";
import { validateGoogleConnection } from "@/lib/adapters/google-live";
import { validateTikTokConnection } from "@/lib/adapters/tiktok-live";
import { validateTaboolaConnection } from "@/lib/adapters/taboola-live";
import {
  connectionCookie,
  getConnections,
  type Connections,
} from "@/lib/connections/store";
import { getMode } from "@/lib/connections/mode";
import { clientKey, rateLimit } from "@/lib/ratelimit";

/**
 * Connect a real ad account for THIS visitor. Credentials are validated
 * against the platform's API, then stored only in the visitor's encrypted
 * httpOnly cookie — never logged, never persisted server-side.
 */

type PlatformKey = "meta" | "google" | "tiktok" | "taboola";

function isPlatform(p: string): p is PlatformKey {
  return ["meta", "google", "tiktok", "taboola"].includes(p);
}

const str = (v: unknown) => String(v ?? "").trim();

async function buildConnection(
  platform: PlatformKey,
  body: Record<string, unknown>,
): Promise<Connections[PlatformKey]> {
  const connectedAt = new Date().toISOString();

  switch (platform) {
    case "meta": {
      const accessToken = str(body.accessToken);
      let accountId = str(body.accountId);
      if (accessToken.length < 20 || !/^(act_)?\d{6,20}$/.test(accountId)) {
        throw new Error("Provide a Marketing API access token and an ad account ID like act_1234567890.");
      }
      accountId = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
      const accountName = await validateMetaConnection(accessToken, accountId);
      return { accessToken, accountId, accountName, connectedAt };
    }
    case "google": {
      const conn = {
        developerToken: str(body.developerToken),
        clientId: str(body.clientId),
        clientSecret: str(body.clientSecret),
        refreshToken: str(body.refreshToken),
        customerId: str(body.customerId).replaceAll("-", ""),
        loginCustomerId: str(body.loginCustomerId).replaceAll("-", "") || undefined,
        accountName: "",
        connectedAt,
      };
      if (
        !conn.developerToken ||
        !conn.clientId ||
        !conn.clientSecret ||
        !conn.refreshToken ||
        !/^\d{10}$/.test(conn.customerId)
      ) {
        throw new Error("All Google Ads fields are required; customer ID is 10 digits.");
      }
      conn.accountName = await validateGoogleConnection(conn);
      return conn;
    }
    case "tiktok": {
      const conn = {
        accessToken: str(body.accessToken),
        advertiserId: str(body.advertiserId),
        accountName: "",
        connectedAt,
      };
      if (conn.accessToken.length < 20 || !/^\d{6,25}$/.test(conn.advertiserId)) {
        throw new Error("Provide a Marketing API access token and a numeric advertiser ID.");
      }
      conn.accountName = await validateTikTokConnection(conn);
      return conn;
    }
    case "taboola": {
      const conn = {
        clientId: str(body.clientId),
        clientSecret: str(body.clientSecret),
        accountId: str(body.accountId),
        accountName: "",
        connectedAt,
      };
      if (!conn.clientId || !conn.clientSecret || conn.accountId.length < 2) {
        throw new Error("Provide the Backstage client ID, client secret, and account ID.");
      }
      conn.accountName = await validateTaboolaConnection(conn);
      return conn;
    }
  }
}

function withCookie(res: Response, connections: Connections): Response {
  const cookie = connectionCookie(connections);
  res.headers.set(
    "set-cookie",
    `${cookie.name}=${cookie.value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${cookie.maxAge}`,
  );
  return res;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ platform: string }> },
) {
  const { platform } = await ctx.params;
  if (!isPlatform(platform)) {
    return Response.json({ error: "Unknown platform" }, { status: 404 });
  }

  if ((await getMode()) === "seeded") {
    return Response.json(
      { error: "Switch to the Live board (top toggle) to connect accounts." },
      { status: 409 },
    );
  }

  const limit = rateLimit(`connect:${clientKey(req)}`, { capacity: 6, refillPerMinute: 1 });
  if (!limit.ok) {
    return Response.json({ error: "Rate limited — try again shortly." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const connection = await buildConnection(platform, body);
    const connections = await getConnections();
    // TS can't narrow the per-platform union through the dynamic key; the
    // switch above guarantees the shape matches the platform.
    (connections as Record<string, unknown>)[platform] = connection;
    return withCookie(
      Response.json({ ok: true, accountName: connection?.accountName }),
      connections,
    );
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Validation failed" },
      { status: 401 },
    );
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ platform: string }> },
) {
  const { platform } = await ctx.params;
  if (!isPlatform(platform)) {
    return Response.json({ error: "Unknown platform" }, { status: 404 });
  }
  const connections = await getConnections();
  delete connections[platform];
  return withCookie(Response.json({ ok: true }), connections);
}
