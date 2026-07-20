import { ArrowRight, CalendarDays, Mail, RefreshCw, Sparkles } from "lucide-react";

import type { CachedTask } from "@/lib/sync/types";

export function DailyBriefing({
  tasks,
  changes,
  events,
  focusTask,
}: {
  tasks: CachedTask[];
  changes: Array<{ id: string; summary: string; createdAt: string; changeKind: string }>;
  events: Array<{ id: string; title: string; startsAt: string | null }>;
  focusTask: CachedTask | null;
}) {
  const upcoming = tasks.filter((task) => !task.completedAt && task.dueAt).slice(0, 3);
  const inbox = tasks.filter((task) => !task.completedAt && task.source === "gmail");
  return <section className="rounded-[1.5rem] border border-teal/20 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="daily-briefing-heading">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-teal">Daily briefing</p><h2 className="mt-1 text-xl font-black tracking-tight" id="daily-briefing-heading">What changed, what matters, what&apos;s next.</h2></div><a className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-teal underline underline-offset-4" href="/inbox">Review inbox <ArrowRight className="size-4" /></a></div>
    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-2xl bg-[#e6f2f0] p-4"><RefreshCw aria-hidden="true" className="size-4 text-teal" /><p className="mt-3 text-sm font-bold text-teal">Since yesterday</p><p className="mt-1 text-sm leading-6 text-slate-700">{changes[0]?.summary ?? "No imported task changes since your last briefing."}</p></article>
      <article className="rounded-2xl bg-[#f7faf9] p-4"><CalendarDays aria-hidden="true" className="size-4 text-teal" /><p className="mt-3 text-sm font-bold text-ink">Upcoming deadlines</p><p className="mt-1 text-sm leading-6 text-slate-700">{upcoming.length ? `${upcoming.length} upcoming task${upcoming.length === 1 ? "" : "s"} in your current term.` : "No upcoming due-dated tasks."}</p>{events[0] ? <p className="mt-2 text-xs font-bold text-teal">Next event · {events[0].title}</p> : null}</article>
      <article className="rounded-2xl bg-[#fff8f3] p-4"><Mail aria-hidden="true" className="size-4 text-action" /><p className="mt-3 text-sm font-bold text-action">Academic inbox</p><p className="mt-1 text-sm leading-6 text-slate-700">{inbox.length ? `${inbox.length} unread email${inbox.length === 1 ? " needs" : "s need"} review.` : "No unread email currently needs action."}</p></article>
      <article className="rounded-2xl bg-[#073f42] p-4 text-white"><Sparkles aria-hidden="true" className="size-4 text-[#f3b68b]" /><p className="mt-3 text-sm font-bold text-[#c7e6dd]">Best next move</p>{focusTask ? <a className="mt-1 block text-sm font-black leading-6 text-white underline decoration-white/30 underline-offset-4" href={`/assignments/${focusTask.id}`}>{focusTask.title}</a> : <p className="mt-1 text-sm leading-6 text-[#d7ebe7]">Capture one small task to choose a next move.</p>}</article>
    </div>
  </section>;
}
