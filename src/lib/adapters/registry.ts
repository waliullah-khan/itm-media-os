/**
 * Adapter registry: the single place platforms are wired up.
 *
 * To take one platform live, replace its `createSeededAdapter` with a real
 * implementation (e.g. `createGoogleAdsAdapter(oauthConfig)`); everything
 * downstream — dashboards, analyst, automations, planner — is unchanged.
 */

import type { Platform, PlatformAdapter } from "@/lib/adapters/types";
import { PLATFORMS } from "@/lib/adapters/types";
import { createSeededAdapter } from "@/lib/adapters/seeded";

const registry = new Map<Platform, PlatformAdapter>(
  PLATFORMS.map((p) => [p, createSeededAdapter(p)]),
);

export function getAdapter(platform: Platform): PlatformAdapter {
  const adapter = registry.get(platform);
  if (!adapter) throw new Error(`No adapter registered for ${platform}`);
  return adapter;
}

export function getAllAdapters(): PlatformAdapter[] {
  return [...registry.values()];
}
