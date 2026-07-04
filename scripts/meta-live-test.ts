/**
 * Live Meta adapter verification — needs ACCESS_TOKEN and AD_ACCOUNT_ID env
 * vars (read-only insights pull; nothing is written or stored).
 *
 *   ACCESS_TOKEN=... AD_ACCOUNT_ID=act_... npx tsx scripts/meta-live-test.ts
 */

import {
  createMetaLiveAdapter,
  validateMetaConnection,
} from "../src/lib/adapters/meta-live";

const token = process.env.ACCESS_TOKEN;
const account = process.env.AD_ACCOUNT_ID;
if (!token || !account) {
  console.error("Set ACCESS_TOKEN and AD_ACCOUNT_ID");
  process.exit(1);
}

(async () => {
  const name = await validateMetaConnection(token, account);
  console.log("validated account:", name);

  const adapter = createMetaLiveAdapter({
    accessToken: token,
    accountId: account.startsWith("act_") ? account : `act_${account}`,
    accountName: name,
    connectedAt: new Date().toISOString(),
  });

  const campaigns = await adapter.getCampaigns();
  console.log("campaigns:", campaigns.length);
  for (const c of campaigns.slice(0, 3)) {
    console.log(" -", c.name.slice(0, 44), c.status, `$${c.dailyBudget}/day`);
  }

  const metrics = await adapter.getDailyMetrics({ from: "2026-04-06", to: "2026-07-04" });
  const spend = metrics.reduce((s, m) => s + m.spend, 0);
  const conv = metrics.reduce((s, m) => s + m.conversions, 0);
  console.log("metric rows:", metrics.length, "| 90d spend:", Math.round(spend), "| conversions:", Math.round(conv));

  if (campaigns.length > 0) {
    const ads = await adapter.getAds(campaigns[0].id);
    console.log("ads in first campaign:", ads.length);
  }
})();
