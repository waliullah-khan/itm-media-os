"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Intro video popup — plays the YouTube product tour whenever someone opens
 * the site. Autoplays muted (browsers block autoplay-with-sound), with a
 * "Tap for sound" control that unmutes on the visitor's click via the YouTube
 * IFrame postMessage API. Shows on every fresh page load; dismiss with the X,
 * Esc, the backdrop, or "Skip to the tool".
 */
const VIDEO_ID = "fYFS5fCK3kw";
const EMBED_SRC =
  `https://www.youtube-nocookie.com/embed/${VIDEO_ID}` +
  `?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`;

export function IntroVideoModal() {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Open on mount (every fresh load). The root layout persists across in-app
  // navigations, so this fires once per real page open — not on route changes.
  useEffect(() => {
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const command = useCallback((func: string, args: unknown[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "*",
    );
  }, []);

  const unmute = useCallback(() => {
    // User gesture → allowed to play with sound.
    command("unMute");
    command("setVolume", [100]);
    command("playVideo");
    setMuted(false);
  }, [command]);

  // Esc to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Media Buying OS — product tour video"
      onMouseDown={(e) => {
        // click on the backdrop (not the card) closes
        if (e.target === e.currentTarget) close();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
      style={{ background: "rgba(32,28,21,0.62)", backdropFilter: "blur(3px)" }}
    >
      <div
        className="animate-[intropop_.32s_cubic-bezier(.2,.7,.2,1)] w-full max-w-4xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
        style={{ boxShadow: "0 40px 120px rgba(32,28,21,0.45)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2 px-5 py-3.5">
          <div className="min-w-0">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
              Watch the tour · 4 min
            </div>
            <div className="truncate font-serif text-[19px] font-semibold text-ink">
              Media Buying <span className="text-primary italic">OS</span> — a guided walkthrough
            </div>
          </div>
          <button
            ref={closeRef}
            onClick={close}
            aria-label="Close video"
            className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-md border border-line text-ink-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Video */}
        <div className="relative aspect-video w-full bg-ink">
          <iframe
            ref={iframeRef}
            src={EMBED_SRC}
            title="Media Buying OS product tour"
            className="absolute inset-0 h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
          {muted && (
            <button
              onClick={unmute}
              className="absolute bottom-4 left-1/2 flex -translate-x-1/2 cursor-pointer items-center gap-2.5 rounded-full border border-white/20 bg-primary px-5 py-2.5 text-[15px] font-medium text-white shadow-lg transition-transform hover:scale-[1.03]"
              style={{ boxShadow: "0 10px 30px rgba(41,75,107,0.45)" }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 10v4h4l5 4V6L7 10H3z" />
                <path d="M16 9a4 4 0 0 1 0 6" />
                <path d="M19 6a8 8 0 0 1 0 12" />
              </svg>
              Tap for sound
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface px-5 py-3">
          <span className="hidden text-[12.5px] text-ink-faint sm:inline">
            Everything in this video is live — close this and click through it yourself.
          </span>
          <button
            onClick={close}
            className="ml-auto cursor-pointer rounded-md px-3 py-2 text-[13.5px] font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Skip to the tool →
          </button>
        </div>
      </div>

      <style>{`@keyframes intropop{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
