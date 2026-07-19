import { CalendarWorkspace } from "@/components/calendar/calendar-workspace";
import { PageHeader } from "@/components/workspace/page-header";
import { ProviderResync, type Provider } from "@/components/integrations/provider-resync";
import { calendarTimeZone, resolveCalendarRange } from "@/lib/calendar/range";
import { requireUser } from "@/lib/auth/guards";
import { requireQuery } from "@/lib/queries/core-page-query-error";
import { taskColumns, toCachedTask, type TaskRow } from "@/lib/tasks/task-view";
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
  const user = await requireUser();
  const supabase = await createClient();
  const [profileResult, preferencesResult, connectionsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("current_term_id")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("reminder_preferences")
      .select("timezone")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("integration_connections")
      .select("provider")
      .eq("user_id", user.id)
      .eq("provider", "google"),
  ]);
  const profile = requireQuery(profileResult, "calendar profile");
  const preferences = requireQuery(preferencesResult, "calendar timezone preference");
  const connections = requireQuery(connectionsResult, "calendar connections") ?? [];
  const savedProviders: Provider[] = connections.flatMap(
    (connection) => connection.provider === "google" ? ["google" as const] : [],
  );
  const timezone = calendarTimeZone(preferences?.timezone);
  const range = resolveCalendarRange(await searchParams, new Date(), timezone);
  const [tasksResult, eventsResult, subjectsResult, termsResult, projectsResult, categoriesResult] = await Promise.all([
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
    supabase.from("subjects").select("id, term_id, code, name").eq("user_id", user.id),
    supabase.from("academic_terms").select("id, name, academic_year").eq("user_id", user.id).order("starts_on"),
    supabase.from("projects").select("id, name, status").eq("user_id", user.id).order("created_at"),
    supabase.from("grade_categories").select("subject_id, name").eq("user_id", user.id),
  ]);
  const tasks = requireQuery(tasksResult, "calendar tasks") ?? [];
  const events = requireQuery(eventsResult, "calendar events") ?? [];
  const subjects = requireQuery(subjectsResult, "calendar task subjects") ?? [];
  const terms = requireQuery(termsResult, "calendar task terms") ?? [];
  const projects = requireQuery(projectsResult, "calendar task projects") ?? [];
  const categories = requireQuery(categoriesResult, "calendar task grade categories") ?? [];
  const currentTermTasks = (tasks as TaskRow[])
    .map(toCachedTask)
    .filter((task) => !profile?.current_term_id || task.termId === profile.current_term_id);

  return (
    <main>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader eyebrow="CALENDAR" title="Scheduled work">
          Task deadlines and imported Google Calendar events share one time-ordered view.
        </PageHeader>
        <ProviderResync providers={savedProviders} />
      </div>
      <p className="mx-auto mt-4 max-w-5xl px-4 text-sm text-slate-600 sm:px-0">
        {new Intl.DateTimeFormat(undefined, { timeZone: timezone }).format(range.from)} – {new Intl.DateTimeFormat(undefined, { timeZone: timezone }).format(new Date(range.to.getTime() - 1))}
      </p>
      <CalendarWorkspace
        approvedCategoryLabelsBySubject={categories.reduce<Record<string, string[]>>((labels, category) => {
          labels[category.subject_id] = [...(labels[category.subject_id] ?? []), category.name];
          return labels;
        }, {})}
        currentTermId={profile?.current_term_id ?? null}
        events={events.flatMap((event) => event.starts_at ? [{ id: event.id, title: event.title, startsAt: event.starts_at, eventUrl: event.event_url, provider: event.provider, isAllDay: event.is_all_day }] : [])}
        initialTasks={currentTermTasks}
        projects={projects.map((project) => ({ id: project.id, label: project.name, status: project.status as "active" | "archived" }))}
        range={{ from: range.from.toISOString(), to: range.to.toISOString() }}
        subjects={subjects.map((subject) => ({ id: subject.id, termId: subject.term_id, label: `${subject.code} · ${subject.name}` }))}
        terms={terms.map((term) => ({ id: term.id, label: `${term.name} ${term.academic_year}` }))}
        timezone={timezone}
        userId={user.id}
      />
    </main>
  );
}
