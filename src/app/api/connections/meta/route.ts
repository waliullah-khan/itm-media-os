import { validateMetaConnection } from "@/lib/adapters/meta-live";
import {
  connectionCookie,
  getConnections,
} from "@/lib/connections/store";
import { clientKey, rateLimit } from "@/lib/ratelimit";

/**
 * Connect a real Meta ad account for THIS visitor. The token is validated
 * against the Graph API, then stored only in the visitor's own encrypted
 * httpOnly cookie — never logged, never persisted server-side.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`connect:${clientKey(req)}`, { capacity: 5, refillPerMinute: 1 });
  if (!limit.ok) {
    return Response.json({ error: "Rate limited — try again shortly." }, { status: 429 });
  }

  let accessToken: string, accountId: string;
  try {
    const body = await req.json();
    accessToken = String(body.accessToken ?? "").trim();
    accountId = String(body.accountId ?? "").trim();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (accessToken.length < 20 || !/^(act_)?\d{6,20}$/.test(accountId)) {
    return Response.json(
      { error: "Provide a Marketing API access token and an ad account ID like act_1234567890." },
      { status: 400 },
    );
  }
  const normalizedId = accountId.startsWith("act_") ? accountId : `act_${accountId}`;

  let accountName: string;
  try {
    accountName = await validateMetaConnection(accessToken, normalizedId);
  } catch (err) {
    return Response.json(
      { error: `Meta rejected the credentials: ${err instanceof Error ? err.message : "unknown error"}` },
      { status: 401 },
    );
  }

  const connections = await getConnections();
  connections.meta = {
    accessToken,
    accountId: normalizedId,
    accountName,
    connectedAt: new Date().toISOString(),
  };

  const res = Response.json({ ok: true, accountName });
  const cookie = connectionCookie(connections);
  res.headers.set(
    "set-cookie",
    `${cookie.name}=${cookie.value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${cookie.maxAge}`,
  );
  return res;
}

export async function DELETE() {
  const connections = await getConnections();
  delete connections.meta;
  const res = Response.json({ ok: true });
  const cookie = connectionCookie(connections);
  res.headers.set(
    "set-cookie",
    `${cookie.name}=${cookie.value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${cookie.maxAge}`,
  );
  return res;
}
