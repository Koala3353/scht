"use client";

import { useState } from "react";

import { TaskList } from "../tasks/task-list";
import { useTaskSyncWorkspace } from "../tasks/use-task-sync-workspace";
import type { TaskProject, TaskSubject, TaskTerm } from "../tasks/task-editor";
import type { CachedTask } from "../../lib/sync/types";

type SaveFailure = {
  task: CachedTask;
  baseUpdatedAt: string | null;
  reason: string;
};

export function SubjectTaskQueue({
  initialTasks,
  currentTermId,
  terms,
  subjects,
  projects,
  representedSubjectId,
  approvedCategoryLabels,
  userId,
}: {
  initialTasks: CachedTask[];
  currentTermId: string | null;
  terms: TaskTerm[];
  subjects: TaskSubject[];
  projects: TaskProject[];
  representedSubjectId: string;
  approvedCategoryLabels: string[];
  userId: string;
}) {
  const { tasks, saveTask: saveLocalTask, syncState } = useTaskSyncWorkspace({
    userId,
    initialTasks,
    filterTasks: (cachedTasks) => cachedTasks.filter((task) => task.subjectId === representedSubjectId && !task.completedAt),
  });
  const [saveFailure, setSaveFailure] = useState<SaveFailure | null>(null);
  const belongsToRepresentedSubject = (task: CachedTask) => task.subjectId === representedSubjectId && (!task.canonicalTask || task.canonicalTask.subjectId === representedSubjectId);
  const representedOpenTasks = tasks.filter((task) => !task.completedAt && belongsToRepresentedSubject(task));
  const nextTask = representedOpenTasks[0] ?? null;
  const remainingTaskCount = representedOpenTasks.length;

  async function saveTask(task: CachedTask, baseUpdatedAt: string | null) {
    try {
      await saveLocalTask(task, baseUpdatedAt);
      setSaveFailure(null);
    } catch (error) {
      setSaveFailure({ task, baseUpdatedAt, reason: error instanceof Error ? error.message : "Task sync failed. Retry this saved change." });
    }
  }

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <h3 className="text-sm font-bold text-ink">Next open assignment</h3>
      {nextTask ? <div className="mt-3"><TaskList approvedCategoryLabelsBySubject={{ [representedSubjectId]: approvedCategoryLabels }} currentTermId={currentTermId} onSave={saveTask} projects={projects} subjects={subjects} tasks={[nextTask]} terms={terms} /></div> : <p className="mt-2 text-sm text-slate-600">No open tasks.</p>}
      {remainingTaskCount > 1 ? <p className="mt-3 text-xs text-slate-600">{remainingTaskCount - 1} more open assignment{remainingTaskCount === 2 ? "" : "s"} in the task workspace.</p> : null}
      {(saveFailure || syncState === "Sync failed" || syncState === "Offline") ? <div className="mt-3 rounded-xl border border-action/30 bg-[#fff8f3] p-3 text-sm text-slate-700" role="status"><p className="font-semibold text-action">{saveFailure?.reason ?? "Reconnect to save task changes to Supabase."}</p>{saveFailure ? <button className="mt-2 min-h-11 rounded-xl border border-action px-3 py-2 font-bold text-action" onClick={() => void saveTask(saveFailure.task, saveFailure.baseUpdatedAt)} type="button">Retry save</button> : null}</div> : null}
      <p className="mt-3 text-xs text-slate-600">Open the full task workspace for all assignments and task filters.</p>
      <a className="mt-1 inline-block text-sm font-semibold text-teal underline decoration-teal/30 underline-offset-4" href={`/planner?task=${nextTask?.id ?? ""}`}>Open task workspace</a>
    </div>
  );
}
