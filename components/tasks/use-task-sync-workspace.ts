"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CachedTask, TaskSyncResponse } from "../../lib/sync/types";
import { hydrateTaskCache, saveTaskLocally, synchronizeTaskCache } from "../../lib/sync/task-client";
import { taskDb } from "../../lib/sync/db";
import { retryTaskOutbox } from "../../lib/sync/outbox";

export type TaskWorkspaceSyncState = "Offline" | "Syncing" | "Synced" | "Needs review" | "Sync failed";

type Options = {
  userId: string;
  initialTasks: CachedTask[];
  currentTermId?: string | null;
  pruneMissingSnapshot?: boolean;
  filterTasks?: (tasks: CachedTask[]) => CachedTask[];
};

function retryDelayUntil(nextRetryAt: number) {
  return Math.max(0, nextRetryAt - Date.now());
}

/** Shared local-first task state for every interactive task projection. */
export function useTaskSyncWorkspace({
  userId,
  initialTasks,
  currentTermId = null,
  pruneMissingSnapshot = false,
  filterTasks,
}: Options) {
  const [tasks, setTasks] = useState<CachedTask[]>(initialTasks);
  const [syncState, setSyncState] = useState<TaskWorkspaceSyncState>("Synced");
  const retryTimer = useRef<number | undefined>(undefined);
  const filterRef = useRef(filterTasks);
  const synchronizeRef = useRef<(() => Promise<TaskSyncResponse | undefined>) | undefined>(undefined);

  useEffect(() => {
    filterRef.current = filterTasks;
  }, [filterTasks]);

  const refreshTasks = useCallback(async () => {
    const cachedTasks = await taskDb.tasks.where("userId").equals(userId).toArray();
    const visibleTasks = filterRef.current ? filterRef.current(cachedTasks) : cachedTasks;
    setTasks(visibleTasks);
    return visibleTasks;
  }, [userId]);

  const scheduleRetry = useCallback((nextRetryAt?: number) => {
    if (retryTimer.current !== undefined) window.clearTimeout(retryTimer.current);
    if (!nextRetryAt || !navigator.onLine) return;
    retryTimer.current = window.setTimeout(() => void synchronizeRef.current?.(), retryDelayUntil(nextRetryAt));
  }, []);

  const synchronize = useCallback(async (): Promise<TaskSyncResponse | undefined> => {
    if (!navigator.onLine) {
      setSyncState("Offline");
      return undefined;
    }
    setSyncState("Syncing");
    try {
      const response = await synchronizeTaskCache(userId);
      const refreshedTasks = await refreshTasks();
      scheduleRetry(response.nextRetryAt);
      setSyncState(
        response.networkError
          ? "Sync failed"
          : refreshedTasks.some((task) => task.syncState === "conflict" || task.syncState === "rejected")
            ? "Needs review"
            : "Synced",
      );
      return response;
    } catch {
      setSyncState("Sync failed");
      return undefined;
    }
  }, [refreshTasks, scheduleRetry, userId]);

  useEffect(() => {
    synchronizeRef.current = synchronize;
  }, [synchronize]);

  const saveTask = useCallback(async (task: CachedTask, baseUpdatedAt: string | null) => {
    setTasks((current) => current.map((candidate) => candidate.id === task.id
      ? { ...task, syncState: "pending", syncError: undefined, canonicalTask: undefined }
      : candidate));
    const response = await saveTaskLocally(userId, task, baseUpdatedAt);
    const refreshedTasks = await refreshTasks();
    scheduleRetry(response.nextRetryAt);
    setSyncState(
      response.networkError
        ? "Sync failed"
        : refreshedTasks.some((candidate) => candidate.syncState === "conflict" || candidate.syncState === "rejected")
          ? "Needs review"
          : "Synced",
    );
    return response;
  }, [refreshTasks, scheduleRetry, userId]);

  const retrySynchronization = useCallback(async () => {
    await retryTaskOutbox(userId);
    return synchronize();
  }, [synchronize, userId]);

  useEffect(() => {
    let active = true;
    async function hydrate() {
      await hydrateTaskCache({ userId, snapshot: initialTasks, currentTermId, pruneMissingSnapshot });
      if (active) await refreshTasks();
      if (active) await synchronize();
    }
    void hydrate();
    const handleOnline = () => void synchronize();
    const handleOffline = () => setSyncState("Offline");
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      active = false;
      if (retryTimer.current !== undefined) window.clearTimeout(retryTimer.current);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [currentTermId, initialTasks, pruneMissingSnapshot, refreshTasks, synchronize, userId]);

  return { tasks, setTasks, saveTask, synchronize, retrySynchronization, refreshTasks, syncState };
}
