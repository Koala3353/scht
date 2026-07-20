"use client";

import type { CachedTask, TaskMutation, TaskSyncResponse } from "./types";

export class TaskSaveError extends Error {
  constructor(message: string, readonly canonicalTask?: CachedTask["canonicalTask"]) {
    super(message);
    this.name = "TaskSaveError";
  }
}

export async function postTaskMutations(mutations: TaskMutation[]): Promise<TaskSyncResponse> {
  const response = await fetch("/api/sync/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mutations }),
  });
  const body = await response.json().catch(() => ({})) as Partial<TaskSyncResponse> & { error?: unknown };
  if (!response.ok) {
    throw new TaskSaveError(typeof body.error === "string" ? body.error : "Task could not be saved to Supabase.");
  }
  if (!Array.isArray(body.accepted) || !Array.isArray(body.rejected)) {
    throw new TaskSaveError("Task save returned an invalid response.");
  }
  return body as TaskSyncResponse;
}

/** Save one task directly to the authenticated Supabase-backed API. */
export async function saveTaskRemotely(
  userId: string,
  task: CachedTask,
  baseUpdatedAt: string | null,
): Promise<CachedTask> {
  if (task.userId !== userId) throw new TaskSaveError("This task belongs to another account.");

  const mutation: TaskMutation = {
    id: crypto.randomUUID(),
    userId,
    operation: "upsert",
    payload: task,
    baseUpdatedAt,
    createdAt: Date.now(),
    attempts: 0,
    nextAttemptAt: 0,
    syncState: "pending",
  };
  const response = await postTaskMutations([mutation]);
  const rejected = response.rejected[0];
  if (rejected) throw new TaskSaveError(rejected.reason, rejected.task);
  const accepted = response.accepted[0];
  if (!accepted) throw new TaskSaveError("Task save was not acknowledged.");

  return { ...accepted.task, userId, syncState: "synced" };
}
