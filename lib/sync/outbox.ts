import { taskDb } from './db';
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

  await taskDb.outbox.put(queuedMutation);
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
        .filter((mutation) => mutation.syncState === 'conflict' || mutation.syncState === 'rejected')
        .map((mutation) =>
          taskDb.outbox.update(mutation.id, {
            syncState: 'pending',
            syncError: undefined,
            baseUpdatedAt: mutation.canonicalTask?.updatedAt ?? mutation.baseUpdatedAt,
            nextAttemptAt: now,
          }),
        ),
    );
  });
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

  let response: TaskSyncResponse;
  try {
    response = await fetcher(dueMutations);
  } catch {
    await deferMutations(dueMutations);
    return {
      accepted: [],
      rejected: [],
      nextRetryAt: await nextRetryAt(userId),
    };
  }

  const acceptedIds = new Set(response.accepted.map(({ id }) => id));
  const rejections = new Map(response.rejected.map((rejection) => [rejection.id, rejection]));

  await taskDb.transaction('rw', taskDb.outbox, async () => {
    await Promise.all(
      dueMutations.map(async (mutation) => {
        if (acceptedIds.has(mutation.id)) {
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
        }
      }),
    );
  });

  return { ...response, nextRetryAt: await nextRetryAt(userId) };
}
