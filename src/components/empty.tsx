import Link from "next/link";
import type { ReactNode } from "react";
import { IconPlug } from "@/components/icons";

/**
 * Shown on the live board when no accounts are connected yet. Every data
 * page renders this instead of an empty chart so the state reads as
 * "connect something," not "broken."
 */
export function LiveEmptyState({
  title = "No connected accounts yet",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-line-strong bg-surface p-10 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
        <IconPlug size={20} />
      </div>
      <h2 className="mt-3 text-[15px] font-semibold">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-muted">
        {children ??
          "The live board only shows data from ad accounts you connect. Connect Google, Meta, TikTok, or Taboola to populate it — or switch to the Seeded demo board to explore the full tool on realistic sample data."}
      </p>
      <Link
        href="/connections"
        className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-md bg-primary px-4 text-[13px] font-medium text-white transition hover:bg-primary-hover"
      >
        <IconPlug size={15} />
        Connect an account
      </Link>
    </div>
  );
}
