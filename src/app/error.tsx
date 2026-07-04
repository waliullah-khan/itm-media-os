"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { IconAlert } from "@/components/icons";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <IconAlert size={26} className="mx-auto text-neg" />
      <h1 className="mt-4 font-display text-2xl font-medium tracking-tight">
        Something broke while loading this view
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
        The screen hit an unexpected error. A live platform pull may have timed
        out — retrying often clears it.
      </p>
      {error.digest && (
        <p className="mt-2 text-[11px] text-ink-faint">
          Reference: <span className="tnum">{error.digest}</span>
        </p>
      )}
      <button
        onClick={() => unstable_retry()}
        className="mt-5 min-h-9 cursor-pointer rounded-md bg-primary px-4 text-[13px] font-medium text-white transition hover:bg-primary-hover active:translate-y-px"
      >
        Try again
      </button>
    </div>
  );
}
