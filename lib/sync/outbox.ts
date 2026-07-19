import { taskDb } from './db';
import type { TaskInput } from '@/lib/validation/task';
import type { TaskMutation, TaskMutationInput, TaskSyncResponse } from './types';

export type TaskOutboxFetcher = (mutations: TaskMutation[]) => Promise<TaskSyncResponse>;

export async function enqueueTaskMutation(mutation: TaskMutationInput) {
  const now = Date.now();
  const queuedMutation: TaskMutation = {
    ...mutation,
    createdAt: mutation.createdAt ?? now,
    attempts: mutation.attempts ?? 0,
    nextAttemptAt: mutation.nextAttemptAt ?? now,
    syncState: mutation.syncState ?? 'pending',
    ...(mutation.syncError ? { syncError: mutation.syncError } : {}),
  };

  const taskId = queuedMutation.payload.id;
  if (!taskId) {
    await taskDb.outbox.put(queuedMutation);
    return queuedMutation;
  }

  // Keep only the latest edit for a task that has not left this device. Its
  // base version must remain the server version that the first edit used.
  const pendingForTask = (await taskDb.outbox.where('userId').equals(mutation.userId).toArray())
    .filter((candidate) => candidate.syncState === 'pending' && candidate.payload.id === taskId)
    .sort((first, second) => first.createdAt - second.createdAt);
  const baseUpdatedAt = pendingForTask[0]?.baseUpdatedAt ?? queuedMutation.baseUpdatedAt;

  await taskDb.transaction('rw', taskDb.outbox, async () => {
    await Promise.all(pendingForTask.map((candidate) => taskDb.outbox.delete(candidate.id)));
    await taskDb.outbox.put({ ...queuedMutation, baseUpdatedAt });
  });
  return queuedMutation;
}

function retryDelay(attempts: number) {
  return Math.min(300_000, 1_000 * 2 ** attempts);
}

async function deferMutations(mutations: TaskMutation[]) {
  const now = Date.now();

  await taskDb.transaction('rw', taskDb.outbox, async () => {
    await Promise.all(
      mutations.map(async (mutation) => {
        const attempts = mutation.attempts + 1;
        await taskDb.outbox.update(mutation.id, {
          attempts,
          nextAttemptAt: now + retryDelay(attempts),
          syncState: 'pending',
          syncError: 'Sync failed. We will retry automatically.',
        });
      }),
    );
  });
}

async function nextRetryAt(userId: string): Promise<number | undefined> {
  const mutations = await taskDb.outbox.where('userId').equals(userId).toArray();
  const retryTimes = mutations
    .filter((mutation) => mutation.syncState === 'pending')
    .map((mutation) => mutation.nextAttemptAt);

  return retryTimes.length > 0 ? Math.min(...retryTimes) : undefined;
}

export async function retryTaskOutbox(userId: string): Promise<void> {
  const mutations = await taskDb.outbox.where('userId').equals(userId).toArray();
  const now = Date.now();
  await taskDb.transaction('rw', taskDb.outbox, async () => {
    await Promise.all(
      mutations
        .filter((mutation) => mutation.syncState === 'pending')
        .map((mutation) =>
          taskDb.outbox.update(mutation.id, {
            nextAttemptAt: now,
          }),
        ),
    );
  });
}

/**
 * Re-enable a conflict only after an editor has intentionally produced a
 * replacement payload from the canonical server version. Generic sync retry
 * never calls this because it would overwrite another device's work.
 */
export async function resolveTaskConflict(
  userId: string,
  mutationId: string,
  resolvedTask: TaskInput,
): Promise<void> {
  const mutation = await taskDb.outbox.get(mutationId);
  if (
    !mutation ||
    mutation.userId !== userId ||
    mutation.syncState !== 'conflict' ||
    !mutation.canonicalTask ||
    resolvedTask.id !== mutation.canonicalTask.id
  ) {
    throw new Error('Resolve this task from its latest server version first.');
  }

  await taskDb.outbox.update(mutationId, {
    payload: resolvedTask,
    baseUpdatedAt: mutation.canonicalTask.updatedAt,
    syncState: 'pending',
    syncError: undefined,
    canonicalTask: undefined,
    nextAttemptAt: Date.now(),
  });
}

async function coalesceDueMutations(mutations: TaskMutation[]): Promise<TaskMutation[]> {
  const grouped = new Map<string, TaskMutation[]>();
  for (const mutation of mutations) {
    const key = mutation.payload.id ?? mutation.id;
    const group = grouped.get(key) ?? [];
    group.push(mutation);
    grouped.set(key, group);
  }

  const latestMutations: TaskMutation[] = [];
  await taskDb.transaction('rw', taskDb.outbox, async () => {
    await Promise.all([...grouped.values()].map(async (group) => {
      const latest = group[group.length - 1];
      const baseUpdatedAt = group[0].baseUpdatedAt;
      if (group.length > 1) {
        await Promise.all(group.slice(0, -1).map((mutation) => taskDb.outbox.delete(mutation.id)));
        if (latest.baseUpdatedAt !== baseUpdatedAt) {
          await taskDb.outbox.update(latest.id, { baseUpdatedAt });
          latest.baseUpdatedAt = baseUpdatedAt;
        }
      }
      latestMutations.push(latest);
    }));
  });
  return latestMutations.sort((first, second) => first.createdAt - second.createdAt);
}

export async function flushTaskOutbox(
  userId: string,
  fetcher: TaskOutboxFetcher,
): Promise<TaskSyncResponse> {
  const dueMutations = (await taskDb.outbox.where('userId').equals(userId).toArray())
    .filter((mutation) => mutation.syncState === 'pending' && mutation.nextAttemptAt <= Date.now())
    .sort((first, second) => first.createdAt - second.createdAt);

  if (dueMutations.length === 0) {
    return { accepted: [], rejected: [], nextRetryAt: await nextRetryAt(userId) };
  }

  const mutationsToFlush = await coalesceDueMutations(dueMutations);
  let response: TaskSyncResponse;
  try {
    response = await fetcher(mutationsToFlush);
  } catch {
    await deferMutations(mutationsToFlush);
    return {
      accepted: [],
      rejected: [],
      nextRetryAt: await nextRetryAt(userId),
      networkError: true,
    };
  }

  const acceptedIds = new Set(response.accepted.map(({ id }) => id));
  const rejections = new Map(response.rejected.map((rejection) => [rejection.id, rejection]));

  await taskDb.transaction('rw', taskDb.outbox, async () => {
    const queuedMutations = await taskDb.outbox.where('userId').equals(userId).toArray();
    await Promise.all(
      mutationsToFlush.map(async (mutation) => {
        if (acceptedIds.has(mutation.id)) {
          const accepted = response.accepted.find(({ id }) => id === mutation.id);
          if (accepted) {
            await Promise.all(
              queuedMutations
                .filter((candidate) => candidate.id !== mutation.id && candidate.syncState === 'pending' && candidate.payload.id === accepted.task.id)
                .map((candidate) => taskDb.outbox.update(candidate.id, { baseUpdatedAt: accepted.task.updatedAt })),
            );
          }
          await taskDb.outbox.delete(mutation.id);
          return;
        }

        const rejection = rejections.get(mutation.id);
        if (rejection) {
          await taskDb.outbox.update(mutation.id, {
            syncState: rejection.syncState,
            syncError: rejection.reason,
            ...(rejection.task ? { canonicalTask: rejection.task } : {}),
          });
          if (rejection.syncState === 'conflict') {
            await Promise.all(
              queuedMutations
                .filter((candidate) => candidate.id !== mutation.id && candidate.syncState === 'pending' && candidate.payload.id === mutation.payload.id)
                .map((candidate) => taskDb.outbox.update(candidate.id, {
                  syncState: 'conflict',
                  syncError: rejection.reason,
                  ...(rejection.task ? { canonicalTask: rejection.task } : {}),
                })),
            );
          }
        }
      }),
    );
  });

  return {
    ...response,
    rejected: response.rejected.map((rejection) => ({
      ...rejection,
      taskId: rejection.taskId ?? mutationsToFlush.find((mutation) => mutation.id === rejection.id)?.payload.id,
    })),
    nextRetryAt: await nextRetryAt(userId),
  };
}
