import { PlannerWorkspace, type PlannerTask } from "@/components/planner/planner-workspace";
import { PageHeader } from "@/components/workspace/page-header";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export default async function PlannerPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: profile }, { data: tasks }, { data: subjects }, { data: terms }, { data: projects }] = await Promise.all([
    supabase.from("profiles").select("current_term_id").eq("id", user.id).maybeSingle(),
    supabase.from("tasks").select("id, title, kind, due_at, priority, term_id, subject_id, project_id, weight_percent, notes, links, effort_minutes, completed_at, updated_at, source, source_id").eq("user_id", user.id).order("due_at", { ascending: true, nullsFirst: false }).limit(200),
    supabase.from("subjects").select("id, term_id, code, name").eq("user_id", user.id),
    supabase.from("academic_terms").select("id, name, academic_year").eq("user_id", user.id).order("starts_on"),
    supabase.from("projects").select("id, name, status").eq("user_id", user.id).order("created_at"),
  ]);
  const plannerTasks: PlannerTask[] = (tasks ?? []).map((task) => ({
    id: task.id,
    userId: user.id,
    title: task.title,
    kind: task.kind,
    dueAt: task.due_at,
    priority: task.priority,
    termId: task.term_id,
    subjectId: task.subject_id,
    projectId: task.project_id,
    weightPercent: task.weight_percent,
    description: task.notes ?? "",
    links: task.links ?? [],
    effortMinutes: task.effort_minutes,
    completedAt: task.completed_at,
    updatedAt: task.updated_at,
    source: task.source ?? "manual",
    sourceId: task.source_id,
    syncState: "synced",
  }));
  return <main><PageHeader eyebrow="TASKS" title="Your shared task workspace">Capture, organize, and execute each task with its full context.</PageHeader><PlannerWorkspace currentTermId={profile?.current_term_id ?? null} projects={(projects ?? []).map((project) => ({ id: project.id, label: project.name, status: project.status as "active" | "archived" }))} subjects={(subjects ?? []).map((subject) => ({ id: subject.id, termId: subject.term_id, label: `${subject.code} · ${subject.name}` }))} tasks={plannerTasks} terms={(terms ?? []).map((term) => ({ id: term.id, label: `${term.name} ${term.academic_year}` }))} /></main>;
}
