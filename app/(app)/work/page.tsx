import { WorkManager } from "@/components/work/work-manager";
import { PageHeader } from "@/components/workspace/page-header";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export default async function WorkPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: projects }, { data: tasks }] = await Promise.all([
    supabase.from("projects").select("id, name, status").eq("user_id", user.id).order("created_at"),
    supabase.from("tasks").select("id, title, project_id, due_at").eq("user_id", user.id).is("completed_at", null).order("due_at", { ascending: true, nullsFirst: false }).limit(50),
  ]);
  return <main><PageHeader eyebrow="WORK" title="Projects with a place for every task.">Create lightweight project context, then attach the work you want to keep together.</PageHeader><WorkManager initialProjects={(projects ?? []) as Array<{ id: string; name: string; status: "active" | "archived" }>} tasks={(tasks ?? []).map((task) => ({ id: task.id, title: task.title, projectId: task.project_id, dueAt: task.due_at }))} /></main>;
}
