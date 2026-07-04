/**
 * Adapter registry: the single place platforms are wired up.
 *
 * Seeded adapters serve the demo dataset. When a visitor connects a real
 * account (see /connections), that platform's adapter is swapped for a live
 * API-backed implementation — everything downstream (dashboards, analyst,
 * automations, planner) is unchanged.
 */

import type { Platform, PlatformAdapter } from "@/lib/adapters/types";
import { PLATFORMS } from "@/lib/adapters/types";
import { createSeededAdapter } from "@/lib/adapters/seeded";
import { createMetaLiveAdapter } from "@/lib/adapters/meta-live";
import type { Connections } from "@/lib/connections/store";

const seeded = new Map<Platform, PlatformAdapter>(
  PLATFORMS.map((p) => [p, createSeededAdapter(p)]),
);

export function getAdapter(platform: Platform, connections: Connections = {}): PlatformAdapter {
  if (platform === "meta" && connections.meta) {
    return createMetaLiveAdapter(connections.meta);
  }
  const adapter = seeded.get(platform);
  if (!adapter) throw new Error(`No adapter registered for ${platform}`);
  return adapter;
}

export function getAllAdapters(connections: Connections = {}): PlatformAdapter[] {
  return PLATFORMS.map((p) => getAdapter(p, connections));
}
