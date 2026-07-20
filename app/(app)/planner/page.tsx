import { PlannerWorkspace } from "@/components/planner/planner-workspace";
import { PageHeader } from "@/components/workspace/page-header";
import { ProviderResync, type Provider } from "@/components/integrations/provider-resync";
import { requireUser } from "@/lib/auth/guards";
import { requireQuery } from "@/lib/queries/core-page-query-error";
import { focusedTaskId, mergeFocusedTask } from "@/lib/tasks/focused-task";
import { taskColumns, toCachedTask, type TaskRow } from "@/lib/tasks/task-view";
import { createClient } from "@/lib/supabase/server";

type PlannerSearchParams = Promise<{ task?: string | string[] }>;

export default async function PlannerPage({ searchParams }: { searchParams: PlannerSearchParams }) {
  const user = await requireUser();
  const supabase = await createClient();
  const rawTaskId = (await searchParams).task;
  const selectedTaskId = focusedTaskId(rawTaskId);
  const [profileResult, tasksResult, subjectsResult, termsResult, projectsResult, categoriesResult, focusedTaskResult, connectionsResult] = await Promise.all([
    supabase.from("profiles").select("current_term_id").eq("id", user.id).maybeSingle(),
    supabase
      .from("tasks")
      .select(taskColumns)
      .eq("user_id", user.id)
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase.from("subjects").select("id, term_id, code, name, archived_at").eq("user_id", user.id),
    supabase
      .from("academic_terms")
      .select("id, name, academic_year")
      .eq("user_id", user.id)
      .order("starts_on"),
    supabase
      .from("projects")
      .select("id, name, status")
      .eq("user_id", user.id)
      .order("created_at"),
    supabase
      .from("grade_categories")
      .select("subject_id, name")
      .eq("user_id", user.id),
    selectedTaskId
      ? supabase
          .from("tasks")
          .select(taskColumns)
          .eq("id", selectedTaskId)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("integration_connections")
      .select("provider")
      .eq("user_id", user.id)
      .in("provider", ["google", "canvas"])
      .eq("status", "connected"),
  ]);
  const profile = requireQuery(profileResult, "tasks profile");
  const tasks = requireQuery(tasksResult, "tasks") ?? [];
  const allSubjects = requireQuery(subjectsResult, "task subjects") ?? [];
  const subjects = allSubjects.filter((subject) => !subject.archived_at);
  const hiddenSubjectIds = new Set(allSubjects.filter((subject) => subject.archived_at).map((subject) => subject.id));
  const terms = requireQuery(termsResult, "task terms") ?? [];
  const projects = requireQuery(projectsResult, "task projects") ?? [];
  const categories = requireQuery(categoriesResult, "task grade categories") ?? [];
  const focusedTask = requireQuery(focusedTaskResult, "focused task");
  const connections = requireQuery(connectionsResult, "task connections") ?? [];
  const savedProviders: Provider[] = connections.flatMap(
    (connection) => connection.provider === "google" || connection.provider === "canvas"
      ? [connection.provider]
      : [],
  );
  const plannerTasks = mergeFocusedTask(tasks as TaskRow[], focusedTask as TaskRow | null)
    .filter((task) => !task.subject_id || !hiddenSubjectIds.has(task.subject_id));

  return (
    <main>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader eyebrow="TASKS" title="Your shared task workspace">
          Capture, organize, and execute each task with its full context.
        </PageHeader>
        <ProviderResync providers={savedProviders} />
      </div>
      <PlannerWorkspace
        currentTermId={profile?.current_term_id ?? null}
        focusedTaskId={selectedTaskId}
        hiddenSubjectIds={[...hiddenSubjectIds]}
        userId={user.id}
        projects={projects.map((project) => ({
          id: project.id,
          label: project.name,
          status: project.status as "active" | "archived",
        }))}
        approvedCategoryLabelsBySubject={categories.reduce<Record<string, string[]>>((labels, category) => {
          const existing = labels[category.subject_id] ?? [];
          labels[category.subject_id] = [...existing, category.name];
          return labels;
        }, {})}
        subjects={subjects.map((subject) => ({
          id: subject.id,
          termId: subject.term_id,
          label: `${subject.code} · ${subject.name}`,
        }))}
        tasks={plannerTasks.map(toCachedTask)}
        terms={terms.map((term) => ({ id: term.id, label: `${term.name} ${term.academic_year}` }))}
      />
    </main>
  );
}
