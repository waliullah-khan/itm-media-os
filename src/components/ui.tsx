import type { ReactNode } from "react";
import { IconArrowUp, IconArrowDown } from "@/components/icons";
import { fmtDelta } from "@/lib/format";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 border-b border-line pb-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-medium leading-[1.1] tracking-tight text-balance">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted text-pretty">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({
  children,
  className = "",
  title,
  right,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  right?: ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border border-line bg-surface p-5 ${className}`}
    >
      {(title || right) && (
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-line pb-2.5">
          {title && (
            <h2 className="text-[11px] font-medium uppercase tracking-[0.09em] text-ink-faint">
              {title}
            </h2>
          )}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

type BadgeTone = "live" | "demo" | "cached" | "pos" | "neg" | "warn" | "neutral";

const badgeTones: Record<BadgeTone, string> = {
  live: "bg-pos/10 text-pos border-pos/30",
  demo: "bg-primary/10 text-primary border-primary/30",
  cached: "bg-accent/10 text-accent border-accent/30",
  pos: "bg-pos/10 text-pos border-pos/30",
  neg: "bg-neg/10 text-neg border-neg/30",
  warn: "bg-accent/10 text-accent border-accent/30",
  neutral: "bg-surface-2 text-ink-muted border-line",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * Period-over-period delta chip. `goodWhenUp=false` flips color semantics
 * for metrics where down is good (CPA, CPC).
 */
export function DeltaChip({
  value,
  goodWhenUp = true,
}: {
  value: number | null;
  goodWhenUp?: boolean;
}) {
  if (value === null)
    return <span className="text-[11px] text-ink-faint">–</span>;
  const up = value > 0;
  const good = goodWhenUp ? up : !up;
  const Icon = up ? IconArrowUp : IconArrowDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-medium tnum ${
        good ? "text-pos" : "text-neg"
      }`}
    >
      <Icon size={11} />
      {fmtDelta(value)}
    </span>
  );
}

export function StatTile({
  label,
  value,
  deltaValue,
  goodWhenUp = true,
  hint,
}: {
  label: string;
  value: string;
  deltaValue?: number | null;
  goodWhenUp?: boolean;
  hint?: string;
}) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.07em] text-ink-faint">
          {label}
        </span>
        {deltaValue !== undefined && (
          <DeltaChip value={deltaValue} goodWhenUp={goodWhenUp} />
        )}
      </div>
      <div className="tnum mt-2 font-mono text-[25px] font-medium leading-none tracking-tight text-ink">
        {value}
      </div>
      {hint && <div className="mt-1.5 text-[11px] leading-snug text-ink-faint">{hint}</div>}
    </div>
  );
}

/**
 * Ruled metric rail. Cells sit on a hairline grid (gap-px over a line-colored
 * backing) instead of each metric floating in its own bordered card box — the
 * generic-dashboard tell. Pass the desktop column count via className, e.g.
 * `lg:grid-cols-6`.
 */
export function Scorecard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line ${className}`}
    >
      {children}
    </div>
  );
}

/** Categorical series colors — validated for CVD separation + contrast on the
 * dark surface (dataviz six-checks). Fixed assignment; never cycled. */
export const PLATFORM_COLORS: Record<string, string> = {
  google: "#2f5a7a",
  meta: "#2e7d5b",
  taboola: "#a8791f",
  tiktok: "#b5476f",
};

export function PlatformDot({ platform }: { platform: string }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ background: PLATFORM_COLORS[platform] ?? "#978d76" }}
      aria-hidden
    />
  );
}
