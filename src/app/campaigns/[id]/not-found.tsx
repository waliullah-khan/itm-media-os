import Link from "next/link";

export default function CampaignNotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <div className="font-display text-5xl font-medium tracking-tight text-primary">
        No such campaign
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
        That campaign ID isn&apos;t in the current dataset. It may belong to a
        platform you haven&apos;t connected, or the link is out of date.
      </p>
      <Link
        href="/campaigns"
        className="mt-5 inline-flex min-h-9 items-center rounded-md bg-primary px-4 text-[13px] font-medium text-white transition hover:bg-primary-hover active:translate-y-px"
      >
        ← All campaigns
      </Link>
    </div>
  );
}
