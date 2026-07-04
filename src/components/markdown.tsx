/**
 * Minimal markdown renderer for the AI Analyst output — the prompt constrains
 * the model to ## headers, bold, and "-" bullets, so a full markdown library
 * isn't warranted. Renders safely as React nodes (no dangerouslySetInnerHTML).
 */

import type { ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  // split on **bold** spans
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: ReactNode[] = [];
  let bullets: string[] = [];
  let key = 0;

  const flushBullets = () => {
    if (bullets.length === 0) return;
    nodes.push(
      <ul key={key++} className="my-2 space-y-1.5 pl-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed">
            <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-primary" />
            <span>{renderInline(b)}</span>
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("- ")) {
      bullets.push(line.slice(2));
      continue;
    }
    flushBullets();
    if (line.startsWith("## ")) {
      nodes.push(
        <h2
          key={key++}
          className="mt-5 mb-1.5 text-[15px] font-semibold tracking-tight first:mt-0"
        >
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith("# ")) {
      nodes.push(
        <h2 key={key++} className="mt-5 mb-1.5 text-[15px] font-semibold first:mt-0">
          {line.slice(2)}
        </h2>,
      );
    } else if (line.trim() !== "") {
      nodes.push(
        <p key={key++} className="my-1.5 text-[13.5px] leading-relaxed text-ink/90">
          {renderInline(line)}
        </p>,
      );
    }
  }
  flushBullets();

  return <div>{nodes}</div>;
}
