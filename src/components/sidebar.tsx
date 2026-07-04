"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconGauge,
  IconTable,
  IconSparkles,
  IconFile,
  IconRadar,
  IconZap,
  IconSliders,
  IconPlug,
} from "@/components/icons";

const NAV = [
  { href: "/", label: "Command Center", icon: IconGauge },
  { href: "/campaigns", label: "Campaigns", icon: IconTable },
  { href: "/analyst", label: "AI Analyst", icon: IconSparkles },
  { href: "/reports", label: "Reports", icon: IconFile },
  { href: "/intelligence", label: "Ad Intelligence", icon: IconRadar },
  { href: "/automations", label: "Automations", icon: IconZap },
  { href: "/planner", label: "Planner", icon: IconSliders },
  { href: "/connections", label: "Connections", icon: IconPlug },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 z-10 hidden h-dvh w-56 shrink-0 flex-col border-r border-line bg-surface/80 backdrop-blur md:flex">
      <div className="px-5 pt-6 pb-5">
        <Link href="/" className="block">
          <div className="font-display text-[19px] font-medium leading-none tracking-tight">
            Media Buying <span className="text-primary">OS</span>
          </div>
          <div className="mt-1.5 text-[10.5px] uppercase tracking-[0.12em] text-ink-faint">
            It&apos;s Today Media
          </div>
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 px-3" aria-label="Primary">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`group relative flex items-center gap-2.5 rounded-md py-2 pr-2.5 pl-3.5 text-[13px] transition-colors ${
                active
                  ? "bg-primary-soft/70 font-medium text-ink"
                  : "text-ink-muted hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <span
                className={`absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-full bg-primary transition-opacity ${
                  active ? "opacity-100" : "opacity-0 group-hover:opacity-30"
                }`}
                aria-hidden
              />
              <Icon size={16} className={active ? "text-primary" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-line px-5 py-4 text-[11px] leading-relaxed text-ink-faint">
        Demo dataset · 4 platforms · 90 days
        <br />
        Live AI + ad-library research
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-line bg-surface/95 py-1.5 backdrop-blur md:hidden"
      aria-label="Primary"
    >
      {NAV.slice(0, 5).map(({ href, label, icon: Icon }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            aria-label={label}
            className={`flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[10px] ${
              active ? "text-primary" : "text-ink-muted"
            }`}
          >
            <Icon size={18} />
            {label.split(" ")[0]}
          </Link>
        );
      })}
    </nav>
  );
}
