import { PlannerWorkspace } from "@/components/planner/planner-workspace";
import { PageHeader } from "@/components/workspace/page-header";
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
  const [profileResult, tasksResult, subjectsResult, termsResult, projectsResult, focusedTaskResult] = await Promise.all([
    supabase.from("profiles").select("current_term_id").eq("id", user.id).maybeSingle(),
    supabase
      .from("tasks")
      .select(taskColumns)
      .eq("user_id", user.id)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(200),
    supabase.from("subjects").select("id, term_id, code, name").eq("user_id", user.id),
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
    selectedTaskId
      ? supabase
          .from("tasks")
          .select(taskColumns)
          .eq("id", selectedTaskId)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const profile = requireQuery(profileResult, "tasks profile");
  const tasks = requireQuery(tasksResult, "tasks") ?? [];
  const subjects = requireQuery(subjectsResult, "task subjects") ?? [];
  const terms = requireQuery(termsResult, "task terms") ?? [];
  const projects = requireQuery(projectsResult, "task projects") ?? [];
  const focusedTask = requireQuery(focusedTaskResult, "focused task");
  const plannerTasks = mergeFocusedTask(tasks as TaskRow[], focusedTask as TaskRow | null);

  return (
    <main>
      <PageHeader eyebrow="TASKS" title="Your shared task workspace">
        Capture, organize, and execute each task with its full context.
      </PageHeader>
      <PlannerWorkspace
        currentTermId={profile?.current_term_id ?? null}
        focusedTaskId={selectedTaskId}
        projects={projects.map((project) => ({
          id: project.id,
          label: project.name,
          status: project.status as "active" | "archived",
        }))}
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
