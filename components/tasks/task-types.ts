import type { CachedTask, TaskMutation, TaskSyncState, TaskView } from '@/lib/sync/types';

function timestamp(value: string): number {
  return new Date(value).getTime();
}

function isLocalAuthoritative(task: CachedTask, serverTask: CachedTask): boolean {
  return task.syncState !== 'synced' || timestamp(task.updatedAt) > timestamp(serverTask.updatedAt);
}

/**
 * Reconciles a server snapshot without ever discarding unsynced local work.
 */
export function mergeTaskSnapshot(
  localTasks: CachedTask[],
  serverTasks: CachedTask[],
  userId: string,
  currentTermId: string | null,
  pruneMissingSnapshot = true,
): CachedTask[] {
  const serverById = new Map(
    serverTasks.filter((task) => task.userId === userId).map((task) => [task.id, task]),
  );
  const merged: CachedTask[] = [];

  for (const localTask of localTasks) {
    if (localTask.userId !== userId) continue;
    const serverTask = serverById.get(localTask.id);
    if (serverTask) {
      merged.push(isLocalAuthoritative(localTask, serverTask) ? localTask : serverTask);
      serverById.delete(localTask.id);
      continue;
    }

    const isMissingSyncedCurrentTerm =
      pruneMissingSnapshot && localTask.syncState === 'synced' && localTask.termId === currentTermId;
    if (!isMissingSyncedCurrentTerm) merged.push(localTask);
  }

  merged.push(...serverById.values());
  return merged;
}

export function syncStateLabel(state: TaskSyncState): string {
  return state === 'conflict' || state === 'rejected' ? 'Needs review' : 'Synced';
}

/**
 * An acknowledgement can arrive after another local edit was queued. In that
 * case the cache remains authoritative until the later mutation is flushed.
 */
export function shouldApplyAcceptedTask(
  localTask: CachedTask | undefined,
  acceptedTask: TaskView,
  pendingMutations: TaskMutation[],
): boolean {
  return !localTask || !pendingMutations.some((mutation) => mutation.payload.id === acceptedTask.id);
}
