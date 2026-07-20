import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/workspace/page-header";
import { PriorityBadge } from "@/components/tasks/priority-visual";
import { requireUser } from "@/lib/auth/guards";
import { sanitizeCanvasAssignmentHtml } from "@/lib/integrations/canvas-assignment-content";
import { requireQuery } from "@/lib/queries/core-page-query-error";
import { taskColumns, toTaskView, type TaskRow } from "@/lib/tasks/task-view";
import { createClient } from "@/lib/supabase/server";

type AssignmentPageProps = { params: Promise<{ taskId: string }> };

export default async function AssignmentPage({ params }: AssignmentPageProps) {
  const user = await requireUser();
  const supabase = await createClient();
  const { taskId } = await params;
  const task = requireQuery(
    await supabase.from("tasks").select(taskColumns).eq("id", taskId).eq("user_id", user.id).eq("source", "canvas").maybeSingle(),
    "Canvas assignment task",
  ) as TaskRow | null;
  if (!task) notFound();

  const [detailResult, subjectResult] = await Promise.all([
    supabase.from("canvas_assignment_details").select("canvas_html, source_url, updated_at").eq("task_id", task.id).eq("user_id", user.id).maybeSingle(),
    task.subject_id ? supabase.from("subjects").select("code, name").eq("id", task.subject_id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  const detail = requireQuery(detailResult, "Canvas assignment detail");
  const subject = requireQuery(subjectResult, "Canvas assignment subject");
  const assignment = toTaskView(task);
  const html = sanitizeCanvasAssignmentHtml(detail?.canvas_html || assignment.description);
  const sourceUrl = detail?.source_url || assignment.links[0] || null;

  return <main className="mx-auto max-w-4xl pb-12">
    <a className="inline-flex min-h-11 items-center text-sm font-bold text-teal underline decoration-teal/30 underline-offset-4" href="/planner">← Back to tasks</a>
    <div className="mt-4 flex flex-col gap-4 border-b border-slate-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
      <PageHeader eyebrow={subject ? `${subject.code} · ${subject.name}` : "CANVAS ASSIGNMENT"} title={assignment.title}>
        {assignment.dueAt ? `Due ${new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(new Date(assignment.dueAt))}` : "No Canvas due date listed."}
      </PageHeader>
      {sourceUrl ? <a className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-teal px-4 py-2 text-sm font-bold text-teal hover:bg-[#e6f2f0]" href={sourceUrl} rel="noreferrer" target="_blank">Open in Canvas <ExternalLink aria-hidden="true" className="size-4" /></a> : null}
    </div>
    <div className="mt-4"><PriorityBadge priority={assignment.priority} /></div>
    <section className="mt-7 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      {html ? <div className="assignment-brief" dangerouslySetInnerHTML={{ __html: html }} /> : <p className="text-slate-700">Canvas did not include instructions for this assignment. Open it in Canvas for the original brief.</p>}
    </section>
  </main>;
}
