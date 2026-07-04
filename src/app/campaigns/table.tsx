"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PLATFORM_LABELS,
  VERTICAL_LABELS,
  PLATFORMS,
  type Platform,
  type Vertical,
} from "@/lib/adapters/types";
import { Badge, PlatformDot } from "@/components/ui";
import { fmtRoas, fmtUsd, fmtNumCompact } from "@/lib/format";

export interface CampaignRow {
  id: string;
  name: string;
  platform: Platform;
  vertical: Vertical;
  status: "active" | "paused";
  spend: number;
  revenue: number;
  profit: number;
  roas: number;
  conversions: number;
  cpa: number | null;
}

type SortKey = "spend" | "revenue" | "profit" | "roas" | "conversions" | "cpa";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "spend", label: "Spend" },
  { key: "revenue", label: "Revenue" },
  { key: "profit", label: "Profit" },
  { key: "roas", label: "ROAS" },
  { key: "conversions", label: "Leads" },
  { key: "cpa", label: "CPA" },
];

export function CampaignTable({ rows }: { rows: CampaignRow[] }) {
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("spend");
  const [dir, setDir] = useState<1 | -1>(-1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter(
        (r) =>
          (platform === "all" || r.platform === platform) &&
          (q === "" ||
            r.name.toLowerCase().includes(q) ||
            VERTICAL_LABELS[r.vertical].toLowerCase().includes(q)),
      )
      .sort((a, b) => {
        const av = a[sort] ?? Infinity;
        const bv = b[sort] ?? Infinity;
        return (av === bv ? 0 : av < bv ? -1 : 1) * dir;
      });
  }, [rows, platform, query, sort, dir]);

  function toggleSort(key: SortKey) {
    if (key === sort) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSort(key);
      setDir(-1);
    }
  }

  return (
    <div>
      {/* Toolbar — controls only, no enclosing box */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-line bg-surface-2 p-0.5">
          {(["all", ...PLATFORMS] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`min-h-8 cursor-pointer rounded px-2.5 text-[12px] font-medium transition-colors ${
                platform === p
                  ? "bg-primary-soft text-ink"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {p === "all" ? "All" : PLATFORM_LABELS[p]}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or vertical…"
          aria-label="Search campaigns"
          className="min-h-8 w-56 rounded-md border border-line bg-surface-2 px-2.5 text-[13px] placeholder:text-ink-faint focus:border-primary focus:outline-none"
        />
        <span className="tnum ml-auto text-[12px] text-ink-faint">
          {filtered.length} of {rows.length} campaigns
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-[13px]">
          <thead>
            <tr className="border-b border-line-strong text-left text-[10.5px] uppercase tracking-[0.07em] text-ink-faint">
              <th className="px-3 pb-2 font-medium">Campaign</th>
              <th className="px-3 pb-2 font-medium">Vertical</th>
              <th className="px-3 pb-2 font-medium">Status</th>
              {COLUMNS.map(({ key, label }) => (
                <th
                  key={key}
                  className="px-3 pb-2 text-right font-medium"
                  aria-sort={
                    sort === key
                      ? dir === -1
                        ? "descending"
                        : "ascending"
                      : "none"
                  }
                >
                  <button
                    onClick={() => toggleSort(key)}
                    className={`cursor-pointer transition-colors hover:text-ink ${
                      sort === key ? "text-ink" : ""
                    }`}
                  >
                    {label}
                    {sort === key ? (dir === -1 ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                onClick={() => router.push(`/campaigns/${r.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/campaigns/${r.id}`);
                  }
                }}
                tabIndex={0}
                role="link"
                aria-label={`Open ${r.name}`}
                className="cursor-pointer border-b border-line transition-colors hover:bg-surface-2/60 focus-visible:bg-surface-2/60"
              >
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2 font-medium">
                    <PlatformDot platform={r.platform} />
                    {r.name}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-ink-muted">
                  {VERTICAL_LABELS[r.vertical]}
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={r.status === "active" ? "pos" : "neutral"}>
                    {r.status}
                  </Badge>
                </td>
                <td className="tnum px-3 py-2.5 text-right font-mono">
                  {fmtUsd(r.spend)}
                </td>
                <td className="tnum px-3 py-2.5 text-right font-mono">
                  {fmtUsd(r.revenue)}
                </td>
                <td
                  className={`tnum px-3 py-2.5 text-right font-mono font-medium ${
                    r.profit >= 0 ? "text-pos" : "text-neg"
                  }`}
                >
                  {fmtUsd(r.profit)}
                </td>
                <td className="tnum px-3 py-2.5 text-right font-mono">
                  {fmtRoas(r.roas)}
                </td>
                <td className="tnum px-3 py-2.5 text-right font-mono">
                  {fmtNumCompact(r.conversions)}
                </td>
                <td className="tnum px-3 py-2.5 text-right font-mono">
                  {r.cpa === null ? "–" : fmtUsd(r.cpa, true)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
