import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <div className="font-display text-6xl font-medium tracking-tight text-primary">
        404
      </div>
      <h1 className="mt-3 font-display text-2xl font-medium tracking-tight">
        This page isn&apos;t on the board
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
        The route you followed doesn&apos;t exist. It may have been renamed, or
        the link was mistyped.
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex min-h-9 items-center rounded-md bg-primary px-4 text-[13px] font-medium text-white transition hover:bg-primary-hover active:translate-y-px"
      >
        Back to Command Center
      </Link>
    </div>
  );
}
