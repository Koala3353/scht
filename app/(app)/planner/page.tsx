import { PlannerWorkspace, type PlannerTask } from "@/components/planner/planner-workspace";
import { PageHeader } from "@/components/workspace/page-header";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export default async function PlannerPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: tasks }, { data: subjects }, { data: terms }, { data: projects }] = await Promise.all([
    supabase.from("tasks").select("id, title, source, priority, due_at, subject_id, term_id, project_id").eq("user_id", user.id).is("completed_at", null).order("due_at", { ascending: true, nullsFirst: false }).limit(100),
    supabase.from("subjects").select("id, code, name").eq("user_id", user.id),
    supabase.from("academic_terms").select("id, name, academic_year, starts_on").eq("user_id", user.id),
    supabase.from("projects").select("id, name").eq("user_id", user.id),
  ]);
  const subjectLabels = new Map((subjects ?? []).map((subject) => [subject.id, `${subject.code} · ${subject.name}`]));
  const termLabels = new Map((terms ?? []).map((term) => [term.id, `${term.name} ${term.academic_year}`]));
  const projectLabels = new Map((projects ?? []).map((project) => [project.id, project.name]));
  const plannerTasks: PlannerTask[] = (tasks ?? []).map((task) => ({
    id: task.id,
    title: task.title,
    source: task.source ?? "manual",
    priority: task.priority,
    dueAt: task.due_at,
    subjectId: task.subject_id,
    subjectLabel: task.subject_id ? subjectLabels.get(task.subject_id) ?? null : null,
    termId: task.term_id,
    termLabel: task.term_id ? termLabels.get(task.term_id) ?? null : null,
    projectLabel: task.project_id ? projectLabels.get(task.project_id) ?? null : null,
  }));
  return <main><PageHeader eyebrow="PLANNER" title="All open tasks">Narrow your plan by source, priority, subject, or term—without losing the larger picture.</PageHeader><PlannerWorkspace tasks={plannerTasks} /></main>;
}
