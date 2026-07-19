import { PageHeader } from "@/components/workspace/page-header";
import { calendarEntries, type CalendarEntry } from "@/lib/calendar/entries";
import { localDayLabel, resolveCalendarRange } from "@/lib/calendar/range";
import { requireUser } from "@/lib/auth/guards";
import { requireQuery } from "@/lib/queries/core-page-query-error";
import { taskColumns, toTaskView, type TaskRow } from "@/lib/tasks/task-view";
import { createClient } from "@/lib/supabase/server";

type CalendarSearchParams = Promise<{
  from?: string | string[];
  to?: string | string[];
}>;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: CalendarSearchParams;
}) {
  const range = resolveCalendarRange(await searchParams);
  const user = await requireUser();
  const supabase = await createClient();
  const [profileResult, tasksResult, eventsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("current_term_id")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select(taskColumns)
      .eq("user_id", user.id)
      .gte("due_at", range.from.toISOString())
      .lt("due_at", range.to.toISOString())
      .order("due_at"),
    supabase
      .from("calendar_events")
      .select("id, title, starts_at, is_all_day, event_url, provider")
      .eq("user_id", user.id)
      .gte("starts_at", range.from.toISOString())
      .lt("starts_at", range.to.toISOString())
      .order("starts_at"),
  ]);
  const profile = requireQuery(profileResult, "calendar profile");
  const tasks = requireQuery(tasksResult, "calendar tasks") ?? [];
  const events = requireQuery(eventsResult, "calendar events") ?? [];
  const currentTermTasks = (tasks as TaskRow[])
    .map(toTaskView)
    .filter((task) => !profile?.current_term_id || task.termId === profile.current_term_id);
  const entries: CalendarEntry[] = calendarEntries(
    currentTermTasks,
    events.flatMap((event) =>
      event.starts_at
        ? [{
            id: event.id,
            title: event.title,
            startsAt: event.starts_at,
            eventUrl: event.event_url,
            provider: event.provider,
            isAllDay: event.is_all_day,
          }]
        : [],
    ),
  );
  const groups = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const day = localDayLabel(entry.at);
    groups.set(day, [...(groups.get(day) ?? []), entry]);
  }

  return (
    <main>
      <PageHeader eyebrow="CALENDAR" title="Scheduled work">
        Task deadlines and imported Google Calendar events share one time-ordered view.
      </PageHeader>
      <p className="mx-auto mt-4 max-w-5xl px-4 text-sm text-slate-600 sm:px-0">
        {range.from.toLocaleDateString()} – {new Date(range.to.getTime() - 1).toLocaleDateString()}
      </p>
      <section className="mx-auto mt-4 max-w-5xl space-y-6 px-4 sm:px-0">
        {[...groups.entries()].map(([day, dayEntries]) => (
          <section key={day}>
            <h2 className="mb-3 text-sm font-bold text-slate-600">{day}</h2>
            <div className="space-y-3">
              {dayEntries.map((entry) => (
                <article className="rounded-2xl border border-slate-200 bg-white p-4" key={entry.id}>
                  <time className="font-bold text-teal" dateTime={entry.at}>
                    {entry.isAllDay ? "All day" : new Date(entry.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </time>
                  <h3 className="mt-1 font-bold">{entry.title}</h3>
                  <p className="text-sm text-slate-600">
                    {entry.detail}
                    {entry.isTask ? (
                      <>
                        {" · "}
                        <a className="font-semibold text-teal underline" href={entry.href}>
                          Open task
                        </a>
                      </>
                    ) : entry.href ? (
                      <>
                        {" · "}
                        <a className="font-semibold text-teal underline" href={entry.href} rel="noreferrer" target="_blank">
                          Open event
                        </a>
                      </>
                    ) : null}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))}
        {!entries.length ? <p className="text-slate-600">No scheduled tasks or imported events in this week.</p> : null}
      </section>
    </main>
  );
}
