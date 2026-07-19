"use client";

import { useState } from "react";

import { TaskList } from "../tasks/task-list";
import type { TaskProject, TaskSubject, TaskTerm } from "../tasks/task-editor";
import type { CachedTask, TaskSyncResponse, TaskView } from "../../lib/sync/types";

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
  approvedCategoryLabels,
}: {
  initialTasks: CachedTask[];
  currentTermId: string | null;
  terms: TaskTerm[];
  subjects: TaskSubject[];
  projects: TaskProject[];
  approvedCategoryLabels: string[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [saveFailure, setSaveFailure] = useState<SaveFailure | null>(null);
  const nextTask = tasks.find((task) => !task.completedAt) ?? null;
  const remainingTaskCount = tasks.filter((task) => !task.completedAt).length;

  async function saveTask(task: CachedTask, baseUpdatedAt: string | null) {
    setTasks((current) => current.map((candidate) => candidate.id === task.id ? { ...task, syncState: "pending" } : candidate));
    const mutationId = crypto.randomUUID();
    const retainFailure = (reason: string, syncState: "conflict" | "rejected" = "rejected", canonicalTask?: TaskView) => {
      const failedTask: CachedTask = { ...task, syncState, syncError: reason, ...(canonicalTask ? { canonicalTask } : {}) };
      setTasks((current) => current.map((candidate) => candidate.id === task.id ? failedTask : candidate));
      setSaveFailure({ task: failedTask, baseUpdatedAt, reason });
    };
    try {
      const response = await fetch("/api/sync/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mutations: [{ id: mutationId, userId: task.userId, operation: "upsert", payload: task, baseUpdatedAt }] }),
      });
      if (!response.ok) {
        retainFailure("Task sync failed. Retry this saved change.");
        return;
      }
      const result = await response.json() as TaskSyncResponse;
      const accepted = result.accepted.find((candidate) => candidate.id === mutationId)?.task;
      if (accepted) {
        setTasks((current) => current.map((candidate) => candidate.id === accepted.id ? { ...accepted, userId: task.userId, syncState: "synced" } : candidate));
        setSaveFailure(null);
        return;
      }
      const rejected = result.rejected.find((candidate) => candidate.id === mutationId);
      retainFailure(rejected?.reason ?? "Task sync did not acknowledge this saved change.", rejected?.syncState ?? "rejected", rejected?.task);
    } catch {
      retainFailure("Task sync failed. Retry this saved change.");
    }
  }

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <h3 className="text-sm font-bold text-ink">Next open assignment</h3>
      {nextTask ? <div className="mt-3"><TaskList approvedCategoryLabelsBySubject={{ [nextTask.subjectId ?? ""]: approvedCategoryLabels }} currentTermId={currentTermId} onSave={saveTask} projects={projects} subjects={subjects} tasks={[nextTask]} terms={terms} /></div> : <p className="mt-2 text-sm text-slate-600">No open tasks.</p>}
      {remainingTaskCount > 1 ? <p className="mt-3 text-xs text-slate-600">{remainingTaskCount - 1} more open assignment{remainingTaskCount === 2 ? "" : "s"} in the task workspace.</p> : null}
      {saveFailure ? <div className="mt-3 rounded-xl border border-action/30 bg-[#fff8f3] p-3 text-sm text-slate-700" role="status"><p className="font-semibold text-action">{saveFailure.reason}</p><button className="mt-2 min-h-11 rounded-xl border border-action px-3 py-2 font-bold text-action" onClick={() => void saveTask(saveFailure.task, saveFailure.baseUpdatedAt)} type="button">Retry saved change</button></div> : null}
      <p className="mt-3 text-xs text-slate-600">Open the full task workspace for all assignments and task filters.</p>
      <a className="mt-1 inline-block text-sm font-semibold text-teal underline decoration-teal/30 underline-offset-4" href={`/planner?task=${nextTask?.id ?? ""}`}>Open task workspace</a>
    </div>
  );
}
