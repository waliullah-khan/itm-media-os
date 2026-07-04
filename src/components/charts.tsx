"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeriesPoint } from "@/lib/data/aggregate";
import { fmtUsdCompact } from "@/lib/format";

const INK_MUTED = "#8b98b1";
const GRID = "#1e293f";
const SPEND = "#4c8df6";
const REVENUE = "#0da678";

function fmtAxisDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-surface-2 px-3 py-2 text-[12px] shadow-lg">
      <div className="mb-1 font-medium text-ink">{fmtAxisDate(label ?? "")}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 tnum">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-ink-muted">{p.name}</span>
          <span className="ml-auto pl-4 font-medium text-ink">
            {fmtUsdCompact(Number(p.value))}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 90-day spend vs revenue, single $ axis, crosshair tooltip. */
export function TrendChart({ data }: { data: SeriesPoint[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Daily spend versus revenue trend">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={REVENUE} stopOpacity={0.22} />
              <stop offset="100%" stopColor={REVENUE} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={fmtAxisDate}
            tick={{ fill: INK_MUTED, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            minTickGap={48}
          />
          <YAxis
            tickFormatter={(v: number) => fmtUsdCompact(v)}
            tick={{ fill: INK_MUTED, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: INK_MUTED, strokeWidth: 1, strokeDasharray: "3 3" }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke={REVENUE}
            strokeWidth={2}
            fill="url(#rev-fill)"
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Area
            type="monotone"
            dataKey="spend"
            name="Spend"
            stroke={SPEND}
            strokeWidth={2}
            fill="none"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-1 flex justify-end gap-4 text-[11px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: REVENUE }} />
          Revenue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: SPEND }} />
          Spend
        </span>
      </div>
    </div>
  );
}

/** Small inline profit sparkline for campaign rows/detail. */
export function Sparkline({
  data,
  color = SPEND,
  height = 36,
}: {
  data: SeriesPoint[];
  color?: string;
  height?: number;
}) {
  return (
    <div style={{ height }} aria-hidden>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <Line
            type="monotone"
            dataKey="profit"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
