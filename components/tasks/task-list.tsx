"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, LoaderCircle, Pencil, RotateCcw } from "lucide-react";

import type { CachedTask } from "@/lib/sync/types";
import { AssignmentPrompt } from "../ai/assignment-prompt";
import { useHasHydrated } from "../format/local-date-time";
import { TaskEditor, sourceLabel, type TaskProject, type TaskSubject, type TaskTerm } from "./task-editor";

type TaskListProps = {
  tasks: CachedTask[];
  currentTermId?: string | null;
  terms: TaskTerm[];
  subjects: TaskSubject[];
  projects: TaskProject[];
  onSave: (task: CachedTask, baseUpdatedAt: string | null) => void | Promise<void>;
  initialEditingId?: string | null;
  approvedCategoryLabelsBySubject?: Record<string, string[]>;
};

function relativeDue(dueAt: string | null | undefined) {
  if (!dueAt) return "No deadline";
  const due = new Date(dueAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const deltaDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
  const dateTime = due.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  if (deltaDays < 0) return `Overdue · ${dateTime}`;
  if (deltaDays === 0) return `Today · ${dateTime}`;
  if (deltaDays === 1) return `Tomorrow · ${dateTime}`;
  return dateTime;
}

export function TaskList({ tasks, currentTermId = null, terms, subjects, projects, onSave, initialEditingId = null, approvedCategoryLabelsBySubject = {} }: TaskListProps) {
  const [editing, setEditing] = useState<string | null>(initialEditingId);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const hydrated = useHasHydrated();
  const subjectLabels = new Map(subjects.map((subject) => [subject.id, subject.label]));
  const projectLabels = new Map(projects.map((project) => [project.id, project.label]));

  if (!tasks.length) return <p className="rounded-xl bg-[#f7faf9] p-4 text-sm text-slate-700">No tasks match these filters.</p>;

  async function toggleCompletion(task: CachedTask) {
    setSavingTaskId(task.id);
    setActionError("");
    try {
      await onSave({ ...task, completedAt: task.completedAt ? null : new Date().toISOString(), updatedAt: new Date().toISOString() }, task.updatedAt);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not save this task.");
    } finally {
      setSavingTaskId(null);
    }
  }

  return (
    <ol className="space-y-3" aria-label="Tasks">
      {actionError ? <li className="rounded-xl border border-action/30 bg-[#fff8f3] px-3 py-2 text-sm font-semibold text-action" role="alert">{actionError}</li> : null}
      {tasks.map((task) => {
        const isEditing = editing === task.id;
        const needsReview = task.syncState === "conflict" || task.syncState === "rejected";
        // Relative and locale-specific dates differ between Vercel and a
        // student's device. Render a stable label until hydration completes.
        const dueLabel = hydrated ? relativeDue(task.dueAt) : (task.dueAt ? "Scheduled" : "No deadline");
        return (
          <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" key={task.id}>
            {isEditing ? (
              <TaskEditor currentTermId={currentTermId} onCancel={() => setEditing(null)} onSave={async (nextTask, baseUpdatedAt) => { await onSave(nextTask, baseUpdatedAt); setEditing(null); }} projects={projects} subjects={subjects} task={task} terms={terms} />
            ) : (
              <div className="flex gap-3">
                <button aria-label={task.completedAt ? `Reopen ${task.title}` : `Complete ${task.title}`} aria-busy={savingTaskId === task.id} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-600 hover:border-teal hover:bg-[#e6f2f0] hover:text-teal disabled:cursor-not-allowed disabled:opacity-50" disabled={needsReview || savingTaskId === task.id} onClick={() => void toggleCompletion(task)} type="button">
                  {savingTaskId === task.id ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : task.completedAt ? <RotateCcw aria-hidden="true" className="size-5" /> : <CheckCircle2 aria-hidden="true" className="size-5" />}
                  <span>{savingTaskId === task.id ? "Saving…" : task.completedAt ? "Reopen" : "Mark done"}</span>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><h3 className={`font-bold text-ink ${task.completedAt ? "line-through text-slate-500" : ""}`}>{task.title}</h3><span className="rounded-md bg-[#e6f2f0] px-2 py-1 text-xs font-bold text-teal">{sourceLabel(task.source)}</span></div>
                      <time className={`mt-1 block text-sm font-semibold ${dueLabel.startsWith("Overdue") ? "text-action" : "text-slate-600"}`} dateTime={task.dueAt ?? undefined}>{dueLabel}</time>
                    </div>
                    <div className="flex flex-wrap items-start gap-2">
                      {!task.completedAt ? <AssignmentPrompt approvedCategoryLabels={task.subjectId ? (approvedCategoryLabelsBySubject[task.subjectId] ?? []) : []} subjectLabel={task.subjectId ? (subjectLabels.get(task.subjectId) ?? "Not assigned") : "Not assigned"} task={task} /> : null}
                      <button aria-label={`Edit ${task.title}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-ink hover:bg-slate-50" onClick={() => setEditing(task.id)} type="button"><Pencil aria-hidden="true" className="size-4" />Edit</button>
                    </div>
                  </div>
                  {task.description && <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-700">{task.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                    <span className="rounded-md bg-slate-100 px-2 py-1 capitalize">{task.kind}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-1 capitalize">{task.priority} priority</span>
                    {task.subjectId && subjectLabels.get(task.subjectId) && <span className="rounded-md bg-slate-100 px-2 py-1">{subjectLabels.get(task.subjectId)}</span>}
                    {task.projectId && projectLabels.get(task.projectId) && <span className="rounded-md bg-slate-100 px-2 py-1">{projectLabels.get(task.projectId)}</span>}
                    {task.effortMinutes && <span className="rounded-md bg-slate-100 px-2 py-1">{task.effortMinutes} min</span>}
                    {task.weightPercent !== null && task.weightPercent !== undefined && <span className="rounded-md bg-[#f7ebe3] px-2 py-1 text-action">Grade impact · {task.weightPercent}%</span>}
                  </div>
                  {task.links.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{task.links.map((link, index) => { const canvasAssignment = task.source === "canvas" && index === 0; const label = canvasAssignment ? "Open Canvas assignment" : index === 0 ? "Open source link" : `Open link ${index + 1}`; return <a className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-teal/30 px-3 text-sm font-bold text-teal transition hover:bg-[#e6f2f0]" href={link} key={link} rel="noreferrer" target="_blank" aria-label={label}>{canvasAssignment ? "Open Canvas assignment" : `Open link ${index + 1}`}<ExternalLink aria-hidden="true" className="size-3.5" /></a>; })}</div>}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export { relativeDue };
