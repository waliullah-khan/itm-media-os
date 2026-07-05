"use client";

import { useState } from "react";
import Link from "next/link";
import type { PendingAction, Rule } from "@/lib/automations/rules";
import { PLATFORM_LABELS, PLATFORMS, type Platform } from "@/lib/adapters/types";
import { Badge, PlatformDot } from "@/components/ui";
import { IconCheck, IconX, IconZap } from "@/components/icons";
import { fmtUsd } from "@/lib/format";

type Decision = "approved" | "rejected";

const ACTION_LABEL: Record<PendingAction["action"], string> = {
  pause: "Pause campaign",
  scale_up: "Scale budget up",
  scale_down: "Scale budget down",
  alert: "Alert team",
};

const ACTION_TONE = {
  pause: "neg",
  scale_up: "pos",
  scale_down: "warn",
  alert: "demo",
} as const;

export function AutomationsClient({
  rules,
  initialPending,
}: {
  rules: Rule[];
  initialPending: PendingAction[];
}) {
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [customActions, setCustomActions] = useState<PendingAction[] | null>(null);

  const keyOf = (a: PendingAction) => `${a.ruleId}:${a.campaignId}`;
  const undecided = initialPending.filter((a) => !decisions[keyOf(a)]);
  const decided = initialPending.filter((a) => decisions[keyOf(a)]);

  return (
    <div className="grid gap-x-8 gap-y-8 lg:grid-cols-3">
      {/* Pending queue */}
      <div className="space-y-8 lg:col-span-2">
        <section>
          <h2 className="mb-4 border-b border-line-strong pb-2.5 text-[11px] font-medium uppercase tracking-[0.09em] text-ink-faint">
            Pending actions — human approval required ({undecided.length})
          </h2>
          {undecided.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ink-muted">
              Queue clear — every triggered action has been reviewed.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {undecided.map((a) => (
                <li key={keyOf(a)} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={ACTION_TONE[a.action]}>
                        {ACTION_LABEL[a.action]}
                        {a.amountPct ? ` ${a.action === "scale_down" ? "−" : "+"}${a.amountPct}%` : ""}
                      </Badge>
                      <Link
                        href={`/campaigns/${a.campaignId}`}
                        className="flex items-center gap-1.5 text-[13px] font-medium hover:underline"
                      >
                        <PlatformDot platform={a.platform} />
                        {a.campaignName}
                      </Link>
                    </div>
                    <div className="mt-1 text-[12px] text-ink-muted">
                      <span className="text-ink-faint">{a.ruleName}:</span> {a.evidence}
                    </div>
                    <div className="mt-0.5 text-[12px]">
                      <span className="text-ink-faint">Est. impact if approved: </span>
                      <span
                        className={`tnum font-medium ${
                          a.estMonthlyImpact >= 0 ? "text-pos" : "text-neg"
                        }`}
                      >
                        {a.estMonthlyImpact >= 0 ? "+" : ""}
                        {fmtUsd(a.estMonthlyImpact)}/mo
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setDecisions((d) => ({ ...d, [keyOf(a)]: "approved" }))}
                      className="flex min-h-9 cursor-pointer items-center gap-1 rounded-md border border-pos/40 bg-pos/10 px-3 text-[12.5px] font-medium text-pos transition-colors hover:bg-pos/20"
                    >
                      <IconCheck size={13} /> Approve
                    </button>
                    <button
                      onClick={() => setDecisions((d) => ({ ...d, [keyOf(a)]: "rejected" }))}
                      className="flex min-h-9 cursor-pointer items-center gap-1 rounded-md border border-line bg-surface-2 px-3 text-[12.5px] text-ink-muted transition-colors hover:text-ink"
                    >
                      <IconX size={13} /> Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {decided.length > 0 && (
          <section>
            <h2 className="mb-4 border-b border-line-strong pb-2.5 text-[11px] font-medium uppercase tracking-[0.09em] text-ink-faint">
              Reviewed this session
            </h2>
            <ul className="divide-y divide-line">
              {decided.map((a) => (
                <li key={keyOf(a)} className="flex items-center gap-3 py-2.5">
                  <Badge tone={decisions[keyOf(a)] === "approved" ? "pos" : "neutral"}>
                    {decisions[keyOf(a)] === "approved" ? "queued for platform push" : "rejected"}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {ACTION_LABEL[a.action]} — {a.campaignName}
                  </span>
                  <button
                    onClick={() =>
                      setDecisions((d) => {
                        const next = { ...d };
                        delete next[keyOf(a)];
                        return next;
                      })
                    }
                    className="cursor-pointer text-[12px] text-ink-faint hover:text-ink"
                  >
                    undo
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
              In production, approved actions are pushed through the platform adapters
              (paused status / budget change) with a full audit trail. The demo stops at
              the approval — by design.
            </p>
          </section>
        )}

        {/* Rule builder */}
        <RuleBuilder onResult={setCustomActions} />
        {customActions && (
          <section>
            <h2 className="mb-4 border-b border-line-strong pb-2.5 text-[11px] font-medium uppercase tracking-[0.09em] text-ink-faint">
              Custom rule matches ({customActions.length})
            </h2>
            {customActions.length === 0 ? (
              <p className="py-3 text-[13px] text-ink-muted">
                No active campaign currently trips that rule. Loosen the threshold or widen the window.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {customActions.map((a) => (
                  <li key={a.campaignId} className="py-2.5">
                    <div className="flex items-center gap-2 text-[13px] font-medium">
                      <PlatformDot platform={a.platform} />
                      {a.campaignName}
                      <Badge tone={ACTION_TONE[a.action]}>{ACTION_LABEL[a.action]}</Badge>
                    </div>
                    <div className="mt-0.5 text-[12px] text-ink-muted">{a.evidence}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {/* Active rules */}
      <div className="lg:border-l lg:border-line lg:pl-8">
        <section>
          <h2 className="mb-4 border-b border-line-strong pb-2.5 text-[11px] font-medium uppercase tracking-[0.09em] text-ink-faint">
            Active rules ({rules.length})
          </h2>
          <ul className="divide-y divide-line">
            {rules.map((r) => (
              <li key={r.id} className="py-3.5 first:pt-0">
                <div className="flex items-center gap-2">
                  <IconZap size={14} className="text-accent" />
                  <span className="text-[13px] font-medium">{r.name}</span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
                  {r.description}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge tone="neutral">{r.windowDays}d window</Badge>
                  <Badge tone="neutral">min ${r.minSpend} spend</Badge>
                  {r.platform && (
                    <Badge tone="neutral">{PLATFORM_LABELS[r.platform]} only</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function RuleBuilder({ onResult }: { onResult: (a: PendingAction[]) => void }) {
  const [metric, setMetric] = useState("cpa");
  const [comparator, setComparator] = useState("gt");
  const [threshold, setThreshold] = useState("45");
  const [windowDays, setWindowDays] = useState("7");
  const [platform, setPlatform] = useState<string>("all");
  const [action, setAction] = useState("alert");
  const [running, setRunning] = useState(false);

  async function evaluate() {
    setRunning(true);
    try {
      const res = await fetch("/api/automations/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          metric,
          comparator,
          threshold: parseFloat(threshold),
          windowDays: parseInt(windowDays, 10),
          platform: platform === "all" ? null : (platform as Platform),
          action,
        }),
      });
      const json = await res.json();
      onResult(json.actions ?? []);
    } finally {
      setRunning(false);
    }
  }

  const selectCls =
    "min-h-9 cursor-pointer rounded-md border border-line bg-surface-2 px-2 text-[13px] focus:border-primary focus:outline-none";

  return (
    <section>
      <h2 className="mb-4 border-b border-line-strong pb-2.5 text-[11px] font-medium uppercase tracking-[0.09em] text-ink-faint">
        Build a rule — evaluated instantly against the account
      </h2>
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-ink-muted">When</span>
        <select value={metric} onChange={(e) => setMetric(e.target.value)} className={selectCls} aria-label="Metric">
          <option value="cpa">CPA</option>
          <option value="roas">ROAS</option>
          <option value="ctr">CTR</option>
          <option value="cvr">CVR</option>
          <option value="spend">Spend</option>
        </select>
        <select value={comparator} onChange={(e) => setComparator(e.target.value)} className={selectCls} aria-label="Comparator">
          <option value="gt">is above</option>
          <option value="lt">is below</option>
        </select>
        <input
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className="min-h-9 w-20 rounded-md border border-line bg-surface-2 px-2 text-[13px] tnum focus:border-primary focus:outline-none"
          aria-label="Threshold"
        />
        <span className="text-ink-muted">over</span>
        <select value={windowDays} onChange={(e) => setWindowDays(e.target.value)} className={selectCls} aria-label="Window">
          {[3, 5, 7, 14, 21, 30].map((d) => (
            <option key={d} value={d}>{d} days</option>
          ))}
        </select>
        <span className="text-ink-muted">on</span>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={selectCls} aria-label="Platform">
          <option value="all">all platforms</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
          ))}
        </select>
        <span className="text-ink-muted">then</span>
        <select value={action} onChange={(e) => setAction(e.target.value)} className={selectCls} aria-label="Action">
          <option value="alert">alert team</option>
          <option value="pause">pause campaign</option>
          <option value="scale_up">scale up 20%</option>
          <option value="scale_down">scale down 20%</option>
        </select>
        <button
          onClick={evaluate}
          disabled={running || !isFinite(parseFloat(threshold))}
          className="min-h-9 cursor-pointer rounded-md bg-primary px-4 text-[13px] font-medium text-white transition hover:bg-primary-hover active:translate-y-px disabled:opacity-40"
        >
          {running ? "Evaluating…" : "Evaluate"}
        </button>
      </div>
      <p className="mt-2 text-[11.5px] text-ink-faint">
        CTR/CVR thresholds are decimals (0.02 = 2%). Campaigns under $200 window spend are ignored as noise.
      </p>
    </section>
  );
}
