/**
 * Board mode: "seeded" (the demo dataset, default) or "live" (only data from
 * accounts the visitor has connected).
 *
 * The rules the mode enforces:
 *  - seeded: platform connections and visitor service keys are ignored
 *    entirely — the demo board can't reach or expose anything private.
 *  - live: ONLY connected accounts feed the boards; nothing seeded leaks in.
 *
 * The cookie is deliberately not httpOnly — it carries no secret, and the
 * client toggle needs to read it to render the current state.
 */

import { cookies } from "next/headers";
import { getConnections, type Connections } from "@/lib/connections/store";

export const MODE_COOKIE = "mbos_mode";

export type BoardMode = "seeded" | "live";

export async function getMode(): Promise<BoardMode> {
  const jar = await cookies();
  return jar.get(MODE_COOKIE)?.value === "live" ? "live" : "seeded";
}

/**
 * Connections as the current mode allows them to be seen: in seeded mode
 * this is always empty, so no route can use a connected account or a
 * visitor-supplied key from the demo board.
 */
export async function getEffectiveConnections(): Promise<{
  mode: BoardMode;
  connections: Connections;
}> {
  const mode = await getMode();
  if (mode === "seeded") return { mode, connections: {} };
  return { mode, connections: await getConnections() };
}

export function countPlatformConnections(connections: Connections): number {
  return ["meta", "google", "tiktok", "taboola"].filter(
    (p) => connections[p as "meta" | "google" | "tiktok" | "taboola"],
  ).length;
}
