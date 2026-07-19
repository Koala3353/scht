import { ArrowUpRight, Sparkles } from "lucide-react";

import type { CachedTask } from "@/lib/sync/types";

export function chooseFocusTask(tasks: CachedTask[]) {
  return [...tasks].sort((first, second) =>
    (first.dueAt ? new Date(first.dueAt).getTime() : Number.POSITIVE_INFINITY) - (second.dueAt ? new Date(second.dueAt).getTime() : Number.POSITIVE_INFINITY) ||
    (first.priority === "high" ? 0 : first.priority === "normal" ? 1 : 2) - (second.priority === "high" ? 0 : second.priority === "normal" ? 1 : 2) ||
    (second.weightPercent ?? 0) - (first.weightPercent ?? 0) ||
    (first.effortMinutes ?? Number.POSITIVE_INFINITY) - (second.effortMinutes ?? Number.POSITIVE_INFINITY) ||
    first.title.localeCompare(second.title),
  )[0] ?? null;
}

export function FocusCard({ task }: { task: CachedTask | null }) {
  if (!task) {
    return (
      <section className="rounded-[1.5rem] border border-dashed border-teal/30 bg-white p-6 sm:p-7">
        <Sparkles className="size-5 text-teal" aria-hidden="true" />
        <h2 className="mt-5 text-xl font-black tracking-tight">
          Your day has room to breathe.
        </h2>
        <p className="mt-2 max-w-md leading-7 text-slate-700">
          Add the next thing that matters. It will remain available when you are
          offline and return when you are ready.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[1.5rem] bg-[#083f42] p-6 text-white shadow-[0_18px_40px_rgba(7,63,66,.18)] sm:p-7">
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-[#c7e6dd]">
            <Sparkles className="size-4" aria-hidden="true" />
            Best next move
          </p>
          <h2 className="mt-5 max-w-xl text-2xl font-black tracking-[-0.025em] text-wrap-balance sm:text-3xl">
            {task.title}
          </h2>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[#f3b68b]">
          <ArrowUpRight className="size-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 max-w-xl leading-7 text-[#d7ebe7]">
        {task.weightPercent
          ? `Worth ${task.weightPercent}% of your course grade.`
          : task.priority === "high"
            ? "High-priority work that deserves your first focused block."
            : "The closest scheduled task in your current term."}
      </p>
    </section>
  );
}
