"use client";

import { useRef, useState } from "react";
import { Badge } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { IconSparkles } from "@/components/icons";
import { PLATFORM_LABELS } from "@/lib/adapters/types";

interface TemplateCard {
  id: string;
  name: string;
  source: string;
  sourceSkill: string;
  description: string;
  platform: string | null;
}

export function ReportsClient({ templates }: { templates: TemplateCard[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);

  async function run(templateId: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setActiveId(templateId);
    setText("");
    setError(null);
    setRunning(true);
    outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateId }),
        signal: controller.signal,
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setText((t) => t + decoder.decode(value, { stream: true }));
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("Something went wrong generating the report.");
    } finally {
      setRunning(false);
    }
  }

  const active = templates.find((t) => t.id === activeId);
  const bySource = new Map<string, TemplateCard[]>();
  for (const t of templates) {
    bySource.set(t.source, [...(bySource.get(t.source) ?? []), t]);
  }

  return (
    <>
      {[...bySource.entries()].map(([source, list]) => (
        <section key={source} className="mb-8">
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.09em] text-ink-faint">
            Ported from the {source}
          </h2>
          <ul className="divide-y divide-line border-t border-line-strong">
            {list.map((t) => {
              const isRunning = running && activeId === t.id;
              return (
                <li
                  key={t.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
                >
                  <div className="min-w-0 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold">{t.name}</span>
                      {t.platform && (
                        <Badge tone="neutral">
                          {PLATFORM_LABELS[t.platform as keyof typeof PLATFORM_LABELS]}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                      {t.description}
                    </p>
                    <code className="mt-1.5 block truncate font-mono text-[10.5px] text-ink-faint">
                      {t.sourceSkill}
                    </code>
                  </div>
                  <button
                    onClick={() => run(t.id)}
                    disabled={running}
                    className="flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 self-start rounded-md bg-primary px-4 text-[12.5px] font-medium text-white transition hover:bg-primary-hover active:translate-y-px disabled:opacity-40"
                  >
                    <IconSparkles size={13} />
                    {isRunning ? "Writing…" : "Run"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div ref={outputRef}>
        {(text || running || error) && active && (
          <section className="mt-2">
            <div className="mb-4 flex items-center justify-between gap-2 border-b border-line-strong pb-2.5">
              <h2 className="font-display text-[17px] font-medium tracking-tight">
                {active.name}
              </h2>
              {running ? (
                <Badge tone="demo">writing…</Badge>
              ) : (
                <Badge tone="live">done</Badge>
              )}
            </div>
            {error && (
              <div className="mb-3 rounded-md border border-neg/30 bg-neg/5 p-2.5 text-[13px] text-neg">
                {error}
              </div>
            )}
            {running && !text && (
              <div className="flex items-center gap-2 py-2 text-[13px] text-ink-muted">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                Reading account data and writing the report…
              </div>
            )}
            <Markdown text={text} />
            {running && text && (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-text-bottom" />
            )}
          </section>
        )}
      </div>
    </>
  );
}
