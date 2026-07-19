"use client";

import { CheckCircle2, Clock3 } from "lucide-react";

import type { CachedTask } from "@/lib/sync/types";

interface AgendaProps {
  tasks: CachedTask[];
  onComplete: (task: CachedTask) => void;
}

function dueTimestamp(task: CachedTask) {
  return task.dueAt ? new Date(task.dueAt).getTime() : Number.POSITIVE_INFINITY;
}

function priorityWeight(task: CachedTask) {
  return task.priority === "high" ? 0 : task.priority === "normal" ? 1 : 2;
}

export function selectAgendaTasks(tasks: CachedTask[], currentTermId: string) {
  return tasks
    .filter((task) => task.termId === currentTermId && !task.completedAt)
    .sort(
      (first, second) =>
        dueTimestamp(first) - dueTimestamp(second) ||
        priorityWeight(first) - priorityWeight(second) ||
        (second.weightPercent ?? 0) - (first.weightPercent ?? 0) ||
        (first.effortMinutes ?? Number.POSITIVE_INFINITY) - (second.effortMinutes ?? Number.POSITIVE_INFINITY) ||
        first.title.localeCompare(second.title),
    );
}

function formatDueTime(dueAt: string | null | undefined) {
  if (!dueAt) return "No deadline";
  return `${new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(dueAt))} · ${new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dueAt))}`;
}

export function Agenda({ tasks, onComplete }: AgendaProps) {
  if (tasks.length === 0) {
    return (
      <section className="rounded-[1.5rem] border border-dashed border-teal/30 bg-white px-6 py-10 text-center">
        <Clock3 className="mx-auto size-6 text-teal" aria-hidden="true" />
        <h3 className="mt-4 text-lg font-black">Nothing is due yet.</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-700">
          Add a task and it will stay available even when you are offline.
        </p>
      </section>
    );
  }

  return (
    <ol aria-label="Current term agenda" className="divide-y divide-slate-200">
      {tasks.map((task) => {
        const highImpact = (task.weightPercent ?? 0) > 0;
        const needsReview = task.syncState === "conflict" || task.syncState === "rejected";
        return (
          <li
            className="grid grid-cols-[4.75rem_minmax(0,1fr)_2.75rem] items-start gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[6rem_minmax(0,1fr)_2.75rem]"
            key={task.id}
          >
            <time
              className="pt-1 text-right text-sm font-bold tabular-nums text-slate-500"
              dateTime={task.dueAt ?? undefined}
            >
              {formatDueTime(task.dueAt)}
            </time>
            <div className="min-w-0">
              <h3 className="font-bold text-ink">{task.title}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {task.kind[0].toUpperCase() + task.kind.slice(1)}
                {task.priority === "high" ? " · High priority" : ""}
              </p>
              {highImpact && (
                <span className="mt-2 inline-flex rounded-md bg-[#f7ebe3] px-2 py-1 text-xs font-bold text-action">
                  Grade impact · {task.weightPercent}%
                </span>
              )}
            </div>
            <button
              aria-label={`Complete ${task.title}`}
              className="grid size-11 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-teal hover:bg-[#e6f2f0] hover:text-teal disabled:cursor-not-allowed disabled:opacity-50"
              disabled={needsReview}
              onClick={() => onComplete(task)}
              type="button"
            >
              <CheckCircle2 aria-hidden="true" className="size-5" />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
