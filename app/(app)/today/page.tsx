import { TodayWorkspace } from "@/components/today/today-workspace";
import { ProviderResync, type Provider } from "@/components/integrations/provider-resync";
import { requireUser } from "@/lib/auth/guards";
import { requireQuery } from "@/lib/queries/core-page-query-error";
import { taskColumns, toCachedTask, type TaskRow } from "@/lib/tasks/task-view";
import { createClient } from "@/lib/supabase/server";

export default async function TodayPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const profile = requireQuery(
    await supabase
      .from("profiles")
      .select("current_term_id")
      .eq("id", user.id)
      .maybeSingle(),
    "today profile",
  );
  const selectedTermId = profile?.current_term_id ?? null;
  const [tasksResult, termsResult, subjectsResult, projectsResult, connectionsResult, changesResult, eventsResult] = await Promise.all([
    selectedTermId
      ? supabase
          .from("tasks")
          .select(taskColumns)
          .eq("user_id", user.id)
          .eq("term_id", selectedTermId)
          .order("due_at", { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("academic_terms")
      .select("id, name, academic_year")
      .eq("user_id", user.id)
      .order("starts_on"),
    supabase.from("subjects").select("id, term_id, code, name, archived_at").eq("user_id", user.id),
    supabase
      .from("projects")
      .select("id, name, status")
      .eq("user_id", user.id)
      .order("created_at"),
    supabase
      .from("integration_connections")
      .select("provider")
      .eq("user_id", user.id)
      .in("provider", ["google", "canvas"])
      .eq("status", "connected"),
    supabase.from("task_change_events").select("id, summary, created_at, change_kind").eq("user_id", user.id).order("created_at", { ascending: false }).limit(4),
    supabase.from("calendar_events").select("id, title, starts_at").eq("user_id", user.id).order("starts_at", { ascending: false }).limit(3),
  ]);
  const tasks = requireQuery(tasksResult, "today tasks") ?? [];
  const terms = requireQuery(termsResult, "today terms") ?? [];
  const allSubjects = requireQuery(subjectsResult, "today subjects") ?? [];
  const subjects = allSubjects.filter((subject) => !subject.archived_at);
  const hiddenSubjectIds = new Set(allSubjects.filter((subject) => subject.archived_at).map((subject) => subject.id));
  const projects = requireQuery(projectsResult, "today projects") ?? [];
  const connections = requireQuery(connectionsResult, "today connections") ?? [];
  // A deployment may reach the app moments before the accompanying schema
  // migration. The briefing can stay useful without its optional change log.
  const changes = changesResult.error ? [] : (changesResult.data ?? []);
  const events = requireQuery(eventsResult, "today events") ?? [];
  const savedProviders: Provider[] = connections.flatMap(
    (connection) => connection.provider === "google" || connection.provider === "canvas"
      ? [connection.provider]
      : [],
  );

  return (
    <TodayWorkspace
      hiddenSubjectIds={[...hiddenSubjectIds]}
      initialTasks={(tasks as TaskRow[]).filter((task) => !task.subject_id || !hiddenSubjectIds.has(task.subject_id)).map(toCachedTask)}
      headerAction={<ProviderResync providers={savedProviders} />}
      changes={changes.map((change) => ({ id: change.id, summary: change.summary, createdAt: change.created_at, changeKind: change.change_kind }))}
      events={events.map((event) => ({ id: event.id, title: event.title, startsAt: event.starts_at }))}
      projects={projects.map((project) => ({
        id: project.id,
        label: project.name,
        status: project.status as "active" | "archived",
      }))}
      selectedTermId={selectedTermId}
      subjects={subjects.map((subject) => ({
        id: subject.id,
        termId: subject.term_id,
        label: `${subject.code} · ${subject.name}`,
      }))}
      terms={terms.map((term) => ({ id: term.id, label: `${term.name} ${term.academic_year}` }))}
      userId={user.id}
    />
  );
}
