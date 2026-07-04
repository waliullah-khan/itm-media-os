"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { BoardMode } from "@/lib/connections/mode";

/**
 * Board mode switch — the top-of-app toggle between the seeded demo board
 * and the live board (which shows only connected-account data). Persists via
 * a cookie and refreshes every server component so the whole app re-renders
 * against the chosen source.
 */
export function ModeSwitch({
  mode,
  connectedCount,
}: {
  mode: BoardMode;
  connectedCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function setMode(next: BoardMode) {
    if (next === mode) return;
    await fetch("/api/mode", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: next }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface/80 px-4 py-2 backdrop-blur sm:px-8">
      <div className="flex items-center gap-2.5">
        <div
          className="flex rounded-md border border-line bg-surface-2 p-0.5"
          role="tablist"
          aria-label="Board data source"
        >
          <button
            role="tab"
            aria-selected={mode === "seeded"}
            onClick={() => setMode("seeded")}
            className={`min-h-8 cursor-pointer rounded px-3 text-[12.5px] font-medium transition-colors ${
              mode === "seeded" ? "bg-primary text-white" : "text-ink-muted hover:text-ink"
            }`}
          >
            Seeded demo
          </button>
          <button
            role="tab"
            aria-selected={mode === "live"}
            onClick={() => setMode("live")}
            className={`min-h-8 cursor-pointer rounded px-3 text-[12.5px] font-medium transition-colors ${
              mode === "live" ? "bg-primary text-white" : "text-ink-muted hover:text-ink"
            }`}
          >
            Live
          </button>
        </div>
        <span className="hidden text-[12px] text-ink-faint sm:inline">
          {mode === "seeded"
            ? "Realistic demo dataset — no accounts or keys used."
            : connectedCount > 0
              ? `Showing only your ${connectedCount} connected ${connectedCount === 1 ? "account" : "accounts"}.`
              : "Connect an account to populate this board."}
        </span>
      </div>
      {pending && (
        <span className="text-[11.5px] text-ink-faint">switching…</span>
      )}
    </div>
  );
}
