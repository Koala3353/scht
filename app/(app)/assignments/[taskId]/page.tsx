import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";

import { TaskWorkspace, type TaskSubtask } from "@/components/assignments/task-workspace";
import { PageHeader } from "@/components/workspace/page-header";
import { requireUser } from "@/lib/auth/guards";
import { sanitizeCanvasAssignmentHtml } from "@/lib/integrations/canvas-assignment-content";
import { requireQuery } from "@/lib/queries/core-page-query-error";
import { taskColumns, toCachedTask, type TaskRow } from "@/lib/tasks/task-view";
import { createClient } from "@/lib/supabase/server";

type AssignmentPageProps = { params: Promise<{ taskId: string }> };

export default async function AssignmentPage({ params }: AssignmentPageProps) {
  const user = await requireUser();
  const supabase = await createClient();
  const { taskId } = await params;
  const task = requireQuery(
    await supabase.from("tasks").select(taskColumns).eq("id", taskId).eq("user_id", user.id).maybeSingle(),
    "task workspace",
  ) as TaskRow | null;
  if (!task) notFound();

  const [detailResult, subjectResult, subtasksResult, sessionResult, relatedResult] = await Promise.all([
    task.source === "canvas"
      ? supabase.from("canvas_assignment_details").select("canvas_html, source_url").eq("task_id", task.id).eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    task.subject_id ? supabase.from("subjects").select("code, name").eq("id", task.subject_id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from("task_subtasks").select("id,title,position,estimated_minutes,completed_at").eq("task_id", task.id).eq("user_id", user.id).order("position").order("created_at"),
    supabase.from("focus_sessions").select("id,planned_minutes,started_at,status").eq("task_id", task.id).eq("user_id", user.id).eq("status", "active").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    task.subject_id
      ? supabase.from("tasks").select("id,title,due_at,source").eq("user_id", user.id).eq("subject_id", task.subject_id).neq("id", task.id).is("completed_at", null).order("due_at", { ascending: true, nullsFirst: false }).limit(4)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const detail = requireQuery(detailResult, "Canvas assignment detail");
  const subject = requireQuery(subjectResult, "task workspace subject");
  // Optional connected-workspace tables are introduced by migration 0017.
  // Do not block the original assignment brief while a workspace is migrating.
  const subtasks = subtasksResult.error ? [] : (subtasksResult.data ?? []);
  const session = sessionResult.error ? null : sessionResult.data;
  const related = requireQuery(relatedResult, "related task workspace items") ?? [];
  const assignment = toCachedTask(task);
  const canvasHtml = detail?.canvas_html ? sanitizeCanvasAssignmentHtml(detail.canvas_html) : "";
  const sourceUrl = detail?.source_url || assignment.links[0] || null;

  return <main className="mx-auto max-w-6xl pb-12">
    <a className="inline-flex min-h-11 items-center text-sm font-bold text-teal underline decoration-teal/30 underline-offset-4" href="/planner">← Back to tasks</a>
    <div className="mt-4 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <PageHeader eyebrow={subject ? `${subject.code} · ${subject.name}` : "TASK WORKSPACE"} title={assignment.title}>
        {assignment.dueAt ? `Due ${new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(new Date(assignment.dueAt))}` : "Keep the context, plan, and next action together."}
      </PageHeader>
      {sourceUrl ? <a className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-teal px-4 py-2 text-sm font-bold text-teal hover:bg-[#e6f2f0]" href={sourceUrl} rel="noreferrer" target="_blank">Open original source <ExternalLink aria-hidden="true" className="size-4" /></a> : null}
    </div>
    {canvasHtml ? <details className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><summary className="cursor-pointer text-sm font-bold text-teal">Read the original Canvas brief</summary><div className="assignment-brief mt-5" dangerouslySetInnerHTML={{ __html: canvasHtml }} /></details> : null}
    <TaskWorkspace activeSession={session as { id: string; planned_minutes: number; started_at: string; status: "active" | "completed" | "cancelled" } | null} relatedTasks={related.map((item) => ({ id: item.id, title: item.title, dueAt: item.due_at, source: item.source }))} subjectLabel={subject ? `${subject.code} · ${subject.name}` : null} subtasks={subtasks as TaskSubtask[]} task={assignment} userId={user.id} />
  </main>;
}
