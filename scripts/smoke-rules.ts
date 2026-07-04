/**
 * Rules-engine smoke test: prints every pending action the preset rules
 * produce against the seeded dataset.
 *
 *   npx tsx scripts/smoke-rules.ts
 */

import { getDataset } from "../src/lib/data/generate";
import { evaluateAll, PRESET_RULES } from "../src/lib/automations/rules";

const ds = getDataset();
const actions = evaluateAll(PRESET_RULES, ds.campaigns, ds.metrics, ds.end);
console.log("pending actions:", actions.length);
for (const a of actions) {
  console.log(
    `[${a.ruleId}] ${a.action} ${a.campaignId} — ${a.evidence} | est ${a.estMonthlyImpact}/mo`,
  );
}
