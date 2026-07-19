import { taskDb } from './db';
import type { TaskInput } from '@/lib/validation/task';
import type { TaskMutation, TaskMutationInput, TaskSyncResponse, TaskView } from './types';

export type TaskOutboxFetcher = (mutations: TaskMutation[]) => Promise<TaskSyncResponse>;

export async function enqueueTaskMutation(mutation: TaskMutationInput) {
  const now = Date.now();
  const queuedMutation: TaskMutation = {
    ...mutation,
    createdAt: mutation.createdAt ?? now,
    attempts: mutation.attempts ?? 0,
    nextAttemptAt: mutation.nextAttemptAt ?? now,
    syncState: mutation.syncState ?? 'pending',
    inFlight: false,
    ...(mutation.syncError ? { syncError: mutation.syncError } : {}),
  };

  const taskId = queuedMutation.payload.id;
  if (!taskId) {
    await taskDb.outbox.put(queuedMutation);
    return queuedMutation;
  }

  // Later edits must start from the same server version as the first pending
  // edit. They stay as separate records: deleting an unacknowledged edit
  // would make a transport failure lose user work.
  const pendingForTask = (await taskDb.outbox.where('userId').equals(mutation.userId).toArray())
    .filter((candidate) => candidate.syncState === 'pending' && candidate.payload.id === taskId)
    .sort((first, second) => first.createdAt - second.createdAt);
  const baseUpdatedAt = pendingForTask[0]?.baseUpdatedAt ?? queuedMutation.baseUpdatedAt;

  const persistedMutation = { ...queuedMutation, baseUpdatedAt };
  await taskDb.outbox.put(persistedMutation);
  return persistedMutation;
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
          inFlight: false,
          syncError: 'Sync failed. We will retry automatically.',
        });
      }),
    );
  });
}

async function nextRetryAt(userId: string): Promise<number | undefined> {
  const mutations = await taskDb.outbox.where('userId').equals(userId).toArray();
  const retryTimes = [...nextActionableMutationByTask(mutations).values()]
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

/**
 * Explicitly retry a terminal rejection. This is deliberately separate from
 * generic retry, which only expedites known-safe pending network work.
 */
export async function retryRejectedTaskMutation(userId: string, mutationId: string): Promise<void> {
  const mutation = await taskDb.outbox.get(mutationId);
  if (!mutation || mutation.userId !== userId || mutation.syncState !== 'rejected' || mutation.inFlight) {
    throw new Error('This saved change is not available to retry.');
  }

  await taskDb.outbox.update(mutationId, {
    syncState: 'pending',
    syncError: undefined,
    nextAttemptAt: Date.now(),
  });
}

/**
 * Preserve an unaccepted conflict for recovery history while applying the
 * canonical task the user explicitly chose. It is never deleted here.
 */
export async function discardTaskConflict(userId: string, mutationId: string): Promise<TaskView> {
  const mutation = await taskDb.outbox.get(mutationId);
  if (!mutation || mutation.userId !== userId || mutation.syncState !== 'conflict' || !mutation.canonicalTask) {
    throw new Error('The latest server version is unavailable.');
  }

  await taskDb.transaction('rw', taskDb.outbox, async () => {
    const queuedMutations = await taskDb.outbox.where('userId').equals(userId).toArray();
    await taskDb.outbox.update(mutationId, {
      syncState: 'rejected',
      inFlight: false,
      syncError: 'You chose the latest server version. Your local version remains in recovery history.',
    });
    // Choosing the server version resolves this chain head, not the user's
    // later edits. Preserve those edits and make their next conditional write
    // start from the canonical version the user just accepted.
    await Promise.all(
      queuedMutations
        .filter((candidate) => candidate.id !== mutationId && candidate.syncState === 'pending' && candidate.payload.id === mutation.payload.id)
        .filter((candidate) => !candidate.inFlight)
        .map((candidate) => taskDb.outbox.update(candidate.id, {
          baseUpdatedAt: mutation.canonicalTask!.updatedAt,
        })),
    );
  });
  return mutation.canonicalTask;
}

/**
 * Terminal recovery history does not block a task chain. A conflict does:
 * its later pending edits remain durable but cannot be selected until an
 * explicit resolution turns the head back into a pending mutation or records
 * an intentional server-version choice.
 */
function nextActionableMutationByTask(mutations: TaskMutation[]): Map<string, TaskMutation> {
  const earliestByTask = new Map<string, TaskMutation>();
  for (const mutation of [...mutations].sort((first, second) => first.createdAt - second.createdAt)) {
    if (mutation.syncState === 'rejected' || mutation.syncState === 'synced') continue;
    const key = mutation.payload.id ?? mutation.id;
    if (!earliestByTask.has(key)) earliestByTask.set(key, mutation);
  }
  return earliestByTask;
}

async function selectDueMutations(userId: string): Promise<TaskMutation[]> {
  const now = Date.now();
  return taskDb.transaction('rw', taskDb.outbox, async () => {
    // Selection and claiming have to share one write transaction. Otherwise
    // two flushes can each select the same due row before either marks it as
    // in flight, then send the same mutation twice.
    const mutations = await taskDb.outbox.where('userId').equals(userId).toArray();
    const earliestByTask = nextActionableMutationByTask(mutations);
    const mutationsToFlush: TaskMutation[] = [];

    for (const candidate of earliestByTask.values()) {
      // Re-read the row instead of trusting the selection snapshot. This also
      // makes the returned list contain only records this caller claimed.
      const mutation = await taskDb.outbox.get(candidate.id);
      if (
        !mutation ||
        mutation.userId !== userId ||
        mutation.syncState !== 'pending' ||
        mutation.inFlight ||
        mutation.nextAttemptAt > now
      ) {
        continue;
      }

      // Revalidate that this is still the FIFO head for its task. A conflict
      // remains a blocking head, while terminal recovery history does not.
      const currentMutations = await taskDb.outbox.where('userId').equals(userId).toArray();
      const taskKey = mutation.payload.id ?? mutation.id;
      if (nextActionableMutationByTask(currentMutations).get(taskKey)?.id !== mutation.id) continue;

      await taskDb.outbox.update(mutation.id, { inFlight: true });
      const claimedMutation = await taskDb.outbox.get(mutation.id);
      if (claimedMutation?.inFlight) mutationsToFlush.push(claimedMutation);
    }

    return mutationsToFlush.sort((first, second) => first.createdAt - second.createdAt);
  });
}

export async function flushTaskOutbox(
  userId: string,
  fetcher: TaskOutboxFetcher,
): Promise<TaskSyncResponse> {
  const mutationsToFlush = await selectDueMutations(userId);
  if (mutationsToFlush.length === 0) {
    return { accepted: [], rejected: [], nextRetryAt: await nextRetryAt(userId) };
  }
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
                .filter((candidate) => !candidate.inFlight)
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
            inFlight: false,
            syncError: rejection.reason,
            ...(rejection.task ? { canonicalTask: rejection.task } : {}),
          });
          // A conflict blocks the FIFO chain at this mutation. Later edits
          // remain pending and durable; rewriting them to conflict would make
          // them impossible to rebase after explicit recovery.
          return;
        }

        // The server responded without an acknowledgement for this mutation.
        // It remains pending and eligible for a later retry, but is no longer
        // owned by the completed request.
        await taskDb.outbox.update(mutation.id, { inFlight: false });
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
