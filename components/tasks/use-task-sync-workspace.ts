"use client";

import { useCallback, useState } from "react";

import { saveTaskRemotely } from "../../lib/sync/task-client";
import type { CachedTask } from "../../lib/sync/types";

export type TaskWorkspaceSyncState = "Offline" | "Syncing" | "Synced" | "Sync failed";

type Options = {
  userId: string;
  initialTasks: CachedTask[];
  currentTermId?: string | null;
  filterTasks?: (tasks: CachedTask[]) => CachedTask[];
};

/** Shared Supabase-only task state. No browser database or offline queue. */
export function useTaskSyncWorkspace({ userId, initialTasks, filterTasks }: Options) {
  const [tasks, setTasks] = useState<CachedTask[]>(() => filterTasks ? filterTasks(initialTasks) : initialTasks);
  const [syncState, setSyncState] = useState<TaskWorkspaceSyncState>("Synced");

  const refreshTasks = useCallback(async () => tasks, [tasks]);

  const saveTask = useCallback(async (task: CachedTask, baseUpdatedAt: string | null) => {
    if (!navigator.onLine) {
      setSyncState("Offline");
      throw new Error("You are offline. Reconnect to save this task to Supabase.");
    }
    setSyncState("Syncing");
    try {
      const saved = await saveTaskRemotely(userId, task, baseUpdatedAt);
      setTasks((current) => {
        const next = current.some((candidate) => candidate.id === saved.id)
          ? current.map((candidate) => candidate.id === saved.id ? saved : candidate)
          : [...current, saved];
        return filterTasks ? filterTasks(next) : next;
      });
      setSyncState("Synced");
      return saved;
    } catch (error) {
      setSyncState("Sync failed");
      throw error;
    }
  }, [filterTasks, userId]);

  const synchronize = useCallback(async () => {
    setSyncState(navigator.onLine ? "Synced" : "Offline");
  }, []);

  return { tasks, setTasks, saveTask, synchronize, retrySynchronization: synchronize, refreshTasks, syncState };
}
