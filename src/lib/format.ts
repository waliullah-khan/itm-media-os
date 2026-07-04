const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const num0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function fmtUsd(n: number, cents = false): string {
  return (cents ? usd2 : usd0).format(n);
}

/** Compact currency for tiles: $1.2M, $45.3K */
export function fmtUsdCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `$${(n / 1_000).toFixed(1)}K`;
  return usd0.format(n);
}

export function fmtNum(n: number): string {
  return num0.format(n);
}

export function fmtNumCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return num0.format(n);
}

export function fmtPct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtRoas(n: number): string {
  return `${n.toFixed(2)}x`;
}

/** Relative change between two values; returns null when base is 0. */
export function delta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

export function fmtDelta(d: number | null, digits = 1): string {
  if (d === null) return "–";
  const sign = d > 0 ? "+" : "";
  return `${sign}${(d * 100).toFixed(digits)}%`;
}
