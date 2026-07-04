/**
 * Dataset sanity check: prints the 30-day scorecard, platform rollup,
 * top/bottom campaigns, and detected anomalies.
 *
 *   npx tsx scripts/sanity.ts
 */

import { getDataset } from "../src/lib/data/generate";
import {
  scorecard,
  byPlatform,
  byCampaign,
  detectAnomalies,
} from "../src/lib/data/aggregate";

const ds = getDataset();
console.log(
  "campaigns:",
  ds.campaigns.length,
  "metric rows:",
  ds.metrics.length,
  "ads:",
  ds.ads.length,
);
console.log("window:", ds.start, "→", ds.end);

const sc = scorecard(ds.metrics, ds.end, 30);
console.log("\n30d scorecard:");
console.log(
  "  spend:",
  Math.round(sc.current.spend),
  "revenue:",
  Math.round(sc.current.revenue),
  "profit:",
  Math.round(sc.current.profit),
);
console.log(
  "  roas:",
  sc.current.roas.toFixed(2),
  "cpa:",
  sc.current.cpa.toFixed(2),
  "leads:",
  Math.round(sc.current.conversions),
);

console.log("\nby platform (30d):");
const rows30 = ds.metrics.filter((m) => m.date >= sc.range.from);
for (const p of byPlatform(rows30, ds.campaigns)) {
  console.log(
    ` ${p.platform.padEnd(8)} spend ${Math.round(p.totals.spend)
      .toString()
      .padStart(6)} roas ${p.totals.roas.toFixed(2)}`,
  );
}

console.log("\ntop/bottom campaigns by profit (30d):");
const bc = byCampaign(rows30);
for (const c of [...bc.slice(0, 4), ...bc.slice(-4)]) {
  console.log(
    ` ${c.campaignId.padEnd(18)} profit ${Math.round(c.totals.profit)
      .toString()
      .padStart(7)} roas ${c.totals.roas.toFixed(2)} cpa ${
      c.totals.cpa === Infinity ? "inf" : c.totals.cpa.toFixed(0)
    }`,
  );
}

console.log("\nanomalies:");
for (const a of detectAnomalies(ds.metrics, ds.campaigns, ds.end)) {
  console.log(` [${a.severity}] ${a.title} — ${a.campaignId} (${a.evidence})`);
}
