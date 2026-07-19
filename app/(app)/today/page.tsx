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
  const [tasksResult, termsResult, subjectsResult, projectsResult, connectionsResult] = await Promise.all([
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
    supabase.from("subjects").select("id, term_id, code, name").eq("user_id", user.id),
    supabase
      .from("projects")
      .select("id, name, status")
      .eq("user_id", user.id)
      .order("created_at"),
    supabase
      .from("integration_connections")
      .select("provider")
      .eq("user_id", user.id)
      .in("provider", ["google", "canvas"]),
  ]);
  const tasks = requireQuery(tasksResult, "today tasks") ?? [];
  const terms = requireQuery(termsResult, "today terms") ?? [];
  const subjects = requireQuery(subjectsResult, "today subjects") ?? [];
  const projects = requireQuery(projectsResult, "today projects") ?? [];
  const savedProviders: Provider[] = (connectionsResult.data ?? []).flatMap(
    (connection) => connection.provider === "google" || connection.provider === "canvas"
      ? [connection.provider]
      : [],
  );

  return (
    <TodayWorkspace
      initialTasks={(tasks as TaskRow[]).map(toCachedTask)}
      headerAction={<ProviderResync providers={savedProviders} />}
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
