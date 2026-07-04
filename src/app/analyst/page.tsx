"use client";

import { useCallback, useRef, useState } from "react";
import { Badge, Card, PageHeader } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { IconSparkles, IconRefresh } from "@/components/icons";

type Source = "live" | "cached" | "fallback" | null;

export default function AnalystPage() {
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [source, setSource] = useState<Source>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (force = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRunning(true);
    setError(null);
    setText("");
    setSource(null);

    try {
      const res = await fetch("/api/analyst", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force }),
        signal: controller.signal,
      });

      if (!res.ok) {
        setError(
          res.status === 429
            ? "Rate limited — the demo caps live AI runs. Try again in a minute."
            : `Request failed (${res.status}).`,
        );
        return;
      }

      setSource((res.headers.get("x-analyst-source") as Source) ?? null);

      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setText((t) => t + decoder.decode(value, { stream: true }));
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError("Something went wrong reaching the analyst.");
      }
    } finally {
      setRunning(false);
    }
  }, []);

  const sourceBadge =
    source === "live" ? (
      <Badge tone="live">live · Claude</Badge>
    ) : source === "cached" ? (
      <Badge tone="cached">cached run</Badge>
    ) : source === "fallback" ? (
      <Badge tone="cached">pre-generated (no API key)</Badge>
    ) : null;

  return (
    <>
      <PageHeader
        title="AI Analyst"
        subtitle="Claude reads the same 30-day rollups the dashboard shows — scorecard, platform split, campaign deltas, detected signals — and writes the weekly review a senior buyer would: verdict, what's working, what's broken with root causes, and a move-money plan in dollars."
        actions={
          <div className="flex items-center gap-2">
            {sourceBadge}
            {text && !running && (
              <button
                onClick={() => run(true)}
                className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface-2 px-3 text-[13px] text-ink-muted transition-colors hover:text-ink"
              >
                <IconRefresh size={14} />
                Re-run
              </button>
            )}
          </div>
        }
      />

      {!text && !running && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-14 text-center">
            <IconSparkles size={28} className="text-primary" />
            <div className="max-w-md text-[13.5px] leading-relaxed text-ink-muted">
              One click produces the analysis a senior media buyer would spend an
              hour assembling: grounded in the live account rollups, streamed as
              it&apos;s written.
            </div>
            <button
              onClick={() => run(false)}
              className="min-h-10 cursor-pointer rounded-md bg-primary px-5 text-[13.5px] font-medium text-white transition hover:bg-primary-hover active:translate-y-px"
            >
              Run weekly review
            </button>
          </div>
        </Card>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-neg/30 bg-neg/5 p-3 text-[13px] text-neg">
          {error}
        </div>
      )}

      {(text || running) && (
        <Card>
          {running && !text && (
            <div className="flex items-center gap-2 py-2 text-[13px] text-ink-muted">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              Reading account data and writing the review…
            </div>
          )}
          <Markdown text={text} />
          {running && text && (
            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-text-bottom" />
          )}
        </Card>
      )}
    </>
  );
}
