"use client";

import { useRef, useState } from "react";
import { Badge, Card } from "@/components/ui";
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
        <div key={source} className="mb-5">
          <h2 className="mb-2.5 text-[13px] font-medium text-ink-muted">
            Ported from the {source}
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.map((t) => (
              <Card key={t.id} className="flex flex-col">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <span className="text-[13.5px] font-semibold leading-snug">{t.name}</span>
                  {t.platform && (
                    <Badge tone="neutral">
                      {PLATFORM_LABELS[t.platform as keyof typeof PLATFORM_LABELS]}
                    </Badge>
                  )}
                </div>
                <p className="mb-3 flex-1 text-[12.5px] leading-relaxed text-ink-muted">
                  {t.description}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <code className="truncate text-[10.5px] text-ink-faint">{t.sourceSkill}</code>
                  <button
                    onClick={() => run(t.id)}
                    disabled={running}
                    className="flex min-h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    <IconSparkles size={13} />
                    {running && activeId === t.id ? "Writing…" : "Run"}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <div ref={outputRef}>
        {(text || running || error) && active && (
          <Card
            title={`${active.name}`}
            right={running ? <Badge tone="demo">writing…</Badge> : <Badge tone="live">done</Badge>}
            className="mt-2"
          >
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
          </Card>
        )}
      </div>
    </>
  );
}
