import { evaluateRule, type Rule, type RuleMetric, type Comparator, type ActionType } from "@/lib/automations/rules";
import { getWorld } from "@/lib/data/world";
import { PLATFORMS, type Platform } from "@/lib/adapters/types";

/** Evaluates a user-built rule against the dataset — powers the rule builder. */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const metric = body.metric as RuleMetric;
  const comparator = body.comparator as Comparator;
  const actionType = body.action as ActionType;
  const threshold = Number(body.threshold);
  const windowDays = Number(body.windowDays);
  const platform = body.platform as Platform | null;

  if (
    !["cpa", "roas", "ctr", "cvr", "spend"].includes(metric) ||
    !["gt", "lt"].includes(comparator) ||
    !["pause", "scale_up", "scale_down", "alert"].includes(actionType) ||
    !isFinite(threshold) ||
    !Number.isInteger(windowDays) ||
    windowDays < 1 ||
    windowDays > 60 ||
    (platform !== null && !PLATFORMS.includes(platform))
  ) {
    return Response.json({ error: "Invalid rule" }, { status: 400 });
  }

  const rule: Rule = {
    id: "custom",
    name: "Custom rule",
    description: "",
    metric,
    mode: "absolute",
    comparator,
    threshold,
    windowDays,
    minSpend: 200,
    platform,
    action: {
      type: actionType,
      amountPct: actionType === "scale_up" || actionType === "scale_down" ? 20 : undefined,
    },
  };

  const { campaigns, metrics, end } = await getWorld();
  const actions = evaluateRule(rule, campaigns, metrics, end);
  return Response.json({ actions });
}
