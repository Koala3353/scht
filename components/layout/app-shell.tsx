"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Bot,
  CalendarDays,
  ClipboardList,
  CircleHelp,
  Ellipsis,
  GraduationCap,
  LayoutDashboard,
  Settings,
} from "lucide-react";

const desktopLinks = [
  { href: "/today", label: "Today", icon: LayoutDashboard },
  { href: "/planner", label: "Tasks", icon: ClipboardList },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/subjects", label: "Subjects", icon: BookOpen },
  { href: "/grades", label: "Grades", icon: GraduationCap },
  { href: "/ai", label: "AI", icon: Bot },
];

const mobileLinks = [
  { href: "/today", label: "Today", icon: LayoutDashboard },
  { href: "/planner", label: "Tasks", icon: ClipboardList },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/subjects", label: "Subjects", icon: BookOpen },
  { href: "/grades", label: "Grades", icon: GraduationCap },
  { href: "/ai", label: "AI", icon: Bot },
  { href: "/settings", label: "More", icon: Ellipsis },
];

function isCurrent(pathname: string, href: string) {
  return href === "/today" ? pathname === href : pathname.startsWith(href);
}

export function AppShell({
  children,
  header,
  hasIntegrationAttention = false,
}: {
  children: ReactNode;
  header: ReactNode;
  hasIntegrationAttention?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f7faf9] text-ink lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
      <aside className="hidden min-h-screen bg-[#073f42] px-4 py-5 text-white lg:sticky lg:top-0 lg:block lg:h-screen">
        <div className="flex h-full flex-col">
          <a
            className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-2xl font-black tracking-[-0.06em] transition hover:bg-white/10 focus-visible:outline-white"
            href="/today"
          >
            <Image alt="" aria-hidden="true" height={32} priority src="/scht-mark.svg" width={32} />
            <span>Scht<span className="text-[#f3b68b]">.</span></span>
            <span className="mt-1 text-xs font-semibold tracking-normal text-[#c7e6dd]">
              Student workspace
            </span>
          </a>

          <nav aria-label="Main navigation" className="mt-10 space-y-1">
            <p className="px-3 pb-2 text-xs font-bold text-[#b8d8d1]">
              Workspace
            </p>
            {desktopLinks.map(({ href, label, icon: Icon }) => {
              const current = isCurrent(pathname, href);
              return (
                <a
                  aria-current={current ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition focus-visible:outline-white ${
                    current
                      ? "bg-white text-[#073f42] shadow-sm"
                      : "text-[#e5f2ef] hover:bg-white/10 hover:text-white"
                  }`}
                  href={href}
                  key={href}
                >
                  <Icon aria-hidden="true" size={19} strokeWidth={2.25} />
                  {label}
                </a>
              );
            })}
          </nav>

          <nav
            aria-label="Account navigation"
            className="mt-auto border-t border-white/15 pt-4"
          >
            <a
              aria-current={
                isCurrent(pathname, "/settings") ? "page" : undefined
              }
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition focus-visible:outline-white ${
                isCurrent(pathname, "/settings")
                  ? "bg-white text-[#073f42] shadow-sm"
                  : "text-[#e5f2ef] hover:bg-white/10 hover:text-white"
              }`}
              href="/settings"
            >
              <span className="relative grid place-items-center"><Settings aria-hidden="true" size={19} strokeWidth={2.25} />{hasIntegrationAttention ? <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 size-2.5 rounded-full bg-red-500 ring-2 ring-[#073f42]" /> : null}</span>
              Settings
              {hasIntegrationAttention ? <span className="sr-only">A connection needs attention</span> : null}
            </a>
            <a
              aria-current={isCurrent(pathname, "/help") ? "page" : undefined}
              className={`mt-1 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition focus-visible:outline-white ${
                isCurrent(pathname, "/help")
                  ? "bg-white text-[#073f42] shadow-sm"
                  : "text-[#e5f2ef] hover:bg-white/10 hover:text-white"
              }`}
              href="/help"
            >
              <CircleHelp aria-hidden="true" size={19} strokeWidth={2.25} />
              Help
            </a>
            <p className="px-3 pt-4 text-xs leading-5 text-[#b8d8d1]">
              Your data stays in your workspace. Connections are always
              reviewable.
            </p>
          </nav>
        </div>
      </aside>

      <div className="min-w-0 px-4 pb-28 pt-4 sm:px-6 sm:pb-24 lg:px-10 lg:pb-10 lg:pt-7 xl:px-12">
        <header className="mx-auto mb-8 flex max-w-7xl flex-col gap-4 border-b border-slate-200/90 pb-5 sm:flex-row sm:items-end sm:justify-between lg:mb-10">
          <a
            className="flex items-center gap-2 text-2xl font-black tracking-[-0.06em] text-teal lg:hidden"
            href="/today"
          >
            <Image alt="" aria-hidden="true" height={32} priority src="/scht-mark.svg" width={32} />
            <span>Scht<span className="text-action">.</span></span>
          </a>
          <div className="w-full sm:ml-auto sm:w-auto">{header}</div>
        </header>
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </div>

      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-3 bottom-3 z-10 flex min-h-[4.5rem] items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white/95 p-1 shadow-[0_14px_35px_rgba(20,37,51,.18)] backdrop-blur lg:hidden"
      >
        {mobileLinks.map(({ href, label, icon: Icon }) => {
          const current = isCurrent(pathname, href.split("#")[0]);
          const hasAttention = hasIntegrationAttention && href === "/settings";
          return (
            <a
              aria-current={current ? "page" : undefined}
              className={`grid min-h-14 min-w-[3.5rem] flex-1 place-items-center rounded-xl px-1 text-center text-[11px] font-bold leading-tight transition ${
                current
                  ? "bg-[#e6f2f0] text-teal"
                  : "text-slate-600 hover:bg-slate-100 hover:text-ink"
              }`}
              href={href}
              key={label}
            >
              <span className="relative grid place-items-center"><Icon aria-hidden="true" size={19} strokeWidth={2.25} />{hasAttention ? <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 size-2.5 rounded-full bg-red-500 ring-2 ring-white" /> : null}</span>
              <span>{label}</span>
              {hasAttention ? <span className="sr-only">A connection needs attention</span> : null}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
