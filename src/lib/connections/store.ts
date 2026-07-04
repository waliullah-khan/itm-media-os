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

export interface Connections {
  meta?: MetaConnection;
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
