"use client";

import { TaskList } from "../tasks/task-list";
import { useTaskSyncWorkspace } from "../tasks/use-task-sync-workspace";
import type { TaskProject, TaskSubject, TaskTerm } from "../tasks/task-editor";
import { calendarEntries, type CalendarEventView, type CalendarEntry } from "../../lib/calendar/entries";
import { localDayLabel } from "../../lib/calendar/range";
import type { CachedTask } from "../../lib/sync/types";

type CalendarWorkspaceProps = {
  userId: string;
  initialTasks: CachedTask[];
  events: CalendarEventView[];
  currentTermId: string | null;
  terms: TaskTerm[];
  subjects: TaskSubject[];
  projects: TaskProject[];
  hiddenSubjectIds?: string[];
  approvedCategoryLabelsBySubject: Record<string, string[]>;
  timezone: string;
  range: { from: string; to: string };
};

export function CalendarWorkspace({
  userId,
  initialTasks,
  events,
  currentTermId,
  terms,
  subjects,
  projects,
  hiddenSubjectIds = [],
  approvedCategoryLabelsBySubject,
  timezone,
  range,
}: CalendarWorkspaceProps) {
  const { tasks, saveTask } = useTaskSyncWorkspace({
    userId,
    initialTasks,
    filterTasks: (cachedTasks) => cachedTasks.filter((task) => task.dueAt
      && task.dueAt >= range.from
      && task.dueAt < range.to
      && (!currentTermId || task.termId === currentTermId)
      && (!task.subjectId || !hiddenSubjectIds.includes(task.subjectId))),
  });
  const entries = calendarEntries(tasks, events);
  const groups = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const day = localDayLabel(entry.at, timezone);
    groups.set(day, [...(groups.get(day) ?? []), entry]);
  }

  return <section className="mx-auto mt-4 max-w-5xl space-y-6 px-4 sm:px-0">
    {[...groups.entries()].map(([day, dayEntries]) => (
      <section key={day}>
        <h2 className="mb-3 text-sm font-bold text-slate-600">{day}</h2>
        <div className="space-y-3">
          {dayEntries.map((entry) => entry.type === "task" ? (
            <TaskList
              approvedCategoryLabelsBySubject={approvedCategoryLabelsBySubject}
              currentTermId={currentTermId}
              key={entry.id}
              onSave={async (task, baseUpdatedAt) => { await saveTask(task, baseUpdatedAt); }}
              projects={projects}
              subjects={subjects}
              tasks={[entry.task]}
              terms={terms}
            />
          ) : (
            <article className="rounded-2xl border border-slate-200 bg-white p-4" key={entry.id}>
              <time className="font-bold text-teal" dateTime={entry.at}>
                {entry.isAllDay ? "All day" : new Intl.DateTimeFormat(undefined, { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(new Date(entry.at))}
              </time>
              <h3 className="mt-1 font-bold">{entry.title}</h3>
              <p className="text-sm text-slate-600">
                {entry.detail}
                {entry.href ? <>{" · "}<a className="font-semibold text-teal underline" href={entry.href} rel="noreferrer" target="_blank">Open event</a></> : null}
              </p>
            </article>
          ))}
        </div>
      </section>
    ))}
    {!entries.length ? <p className="text-slate-600">No scheduled tasks or imported events in this week.</p> : null}
  </section>;
}
