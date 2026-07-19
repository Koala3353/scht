"use client";

import { mergeTaskSnapshot, shouldApplyAcceptedTask } from "../../components/tasks/task-types";

import { taskDb } from "./db";
import { enqueueTaskMutation, flushTaskOutbox } from "./outbox";
import type { CachedTask, TaskMutation, TaskSyncResponse } from "./types";

export async function postTaskMutations(mutations: TaskMutation[]): Promise<TaskSyncResponse> {
  const response = await fetch("/api/sync/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mutations }),
  });
  if (!response.ok) throw new Error("Task sync failed.");
  return response.json() as Promise<TaskSyncResponse>;
}

/**
 * Reconcile a server projection into the authenticated cache. Projections such
 * as Calendar and Subjects are partial, so they deliberately do not prune
 * cached rows which fall outside their current query.
 */
export async function hydrateTaskCache({
  userId,
  snapshot,
  currentTermId = null,
  pruneMissingSnapshot = false,
}: {
  userId: string;
  snapshot: CachedTask[];
  currentTermId?: string | null;
  pruneMissingSnapshot?: boolean;
}) {
  const localTasks = await taskDb.tasks.where("userId").equals(userId).toArray();
  const mergedTasks = mergeTaskSnapshot(localTasks, snapshot, userId, currentTermId, pruneMissingSnapshot);
  await taskDb.transaction("rw", taskDb.tasks, async () => {
    const mergedIds = new Set(mergedTasks.map((task) => task.id));
    await Promise.all(
      localTasks
        .filter((task) => !mergedIds.has(task.id))
        .map((task) => taskDb.tasks.delete(task.id)),
    );
    await taskDb.tasks.bulkPut(mergedTasks);
  });
  return mergedTasks;
}

/** Apply sync acknowledgements to the same user-scoped cache used offline. */
export async function synchronizeTaskCache(userId: string): Promise<TaskSyncResponse> {
  const response = await flushTaskOutbox(userId, postTaskMutations);
  await taskDb.transaction("rw", taskDb.tasks, async () => {
    const pendingMutations = (await taskDb.outbox.where("userId").equals(userId).toArray())
      .filter((mutation) => mutation.syncState === "pending");
    await Promise.all(
      response.accepted.map(async ({ task }) => {
        const localTask = await taskDb.tasks.get(task.id);
        if (shouldApplyAcceptedTask(localTask, task, pendingMutations)) {
          await taskDb.tasks.put({ ...task, userId, syncState: "synced" });
        }
      }),
    );
    await Promise.all(
      response.rejected.map(async ({ id, taskId, task: canonicalTask, reason, syncState }) => {
        const mutation = await taskDb.outbox.get(id);
        const affectedTaskId = taskId ?? mutation?.payload.id;
        if (!affectedTaskId) return;
        const localTask = await taskDb.tasks.get(affectedTaskId);
        if (localTask?.userId === userId) {
          await taskDb.tasks.update(affectedTaskId, {
            syncState,
            syncError: reason,
            ...(canonicalTask ? { canonicalTask } : {}),
          });
        }
      }),
    );
  });
  return response;
}

/**
 * Persist before transport. A failed or offline request leaves both the task
 * and its mutation in IndexedDB for retry after navigation or refresh.
 */
export async function saveTaskLocally(
  userId: string,
  task: CachedTask,
  baseUpdatedAt: string | null,
): Promise<TaskSyncResponse> {
  if (task.userId !== userId) throw new Error("This task belongs to another account.");
  await taskDb.tasks.put({ ...task, syncState: "pending", syncError: undefined, canonicalTask: undefined });
  await enqueueTaskMutation({
    id: crypto.randomUUID(),
    userId,
    operation: "upsert",
    payload: task,
    baseUpdatedAt,
  });
  return synchronizeTaskCache(userId);
}
