import type { CachedTask } from "@/lib/sync/types";

export type CalendarEventView = {
  id: string;
  title: string;
  startsAt: string;
  eventUrl: string | null;
  provider: string;
  isAllDay: boolean;
};

export type CalendarTaskEntry = {
  id: string;
  at: string;
  task: CachedTask;
  type: "task";
};

export type CalendarEventEntry = {
  id: string;
  title: string;
  at: string;
  detail: string;
  href: string;
  type: "event";
  isAllDay: boolean;
};

export type CalendarEntry = CalendarTaskEntry | CalendarEventEntry;

/** Calendar task entries retain the complete executable task contract. */
export function calendarEntries(tasks: CachedTask[], events: CalendarEventView[]): CalendarEntry[] {
  return [
    ...tasks.flatMap((task) =>
      task.dueAt
        ? [{
            id: `task-${task.id}`,
            at: task.dueAt,
            task,
            type: "task" as const,
          }]
        : [],
    ),
    ...events.map((event) => ({
      id: `event-${event.id}`,
      title: event.title,
      at: event.startsAt,
      detail: event.provider === "google_calendar" ? "Google Calendar" : event.provider,
      href: event.eventUrl ?? "",
      type: "event" as const,
      isAllDay: event.isAllDay,
    })),
  ].sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime());
}
