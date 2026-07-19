import type { TaskView } from "@/lib/sync/types";

export type CalendarEventView = {
  id: string;
  title: string;
  startsAt: string;
  eventUrl: string | null;
  provider: string;
  isAllDay: boolean;
};

export type CalendarEntry = {
  id: string;
  title: string;
  at: string;
  detail: string;
  href: string;
  isTask: boolean;
  isAllDay: boolean;
};

export function calendarEntries(tasks: TaskView[], events: CalendarEventView[]): CalendarEntry[] {
  return [
    ...tasks.flatMap((task) =>
      task.dueAt
        ? [{
            id: `task-${task.id}`,
            title: task.title,
            at: task.dueAt,
            detail: task.source === "gmail" ? "Gmail task" : task.source === "canvas" ? "Canvas task" : "Task",
            href: `/planner?task=${task.id}`,
            isTask: true,
            isAllDay: false,
          }]
        : [],
    ),
    ...events.map((event) => ({
      id: `event-${event.id}`,
      title: event.title,
      at: event.startsAt,
      detail: event.provider === "google_calendar" ? "Google Calendar" : event.provider,
      href: event.eventUrl ?? "",
      isTask: false,
      isAllDay: event.isAllDay,
    })),
  ].sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime());
}
