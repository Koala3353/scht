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
        });
      }),
    );
  });
}

export async function flushTaskOutbox(fetcher: TaskOutboxFetcher): Promise<TaskSyncResponse> {
  const dueMutations = await taskDb.outbox
    .where('nextAttemptAt')
    .belowOrEqual(Date.now())
    .sortBy('createdAt');

  if (dueMutations.length === 0) {
    return { accepted: [], rejected: [] };
  }

  let response: TaskSyncResponse;
  try {
    response = await fetcher(dueMutations);
  } catch {
    await deferMutations(dueMutations);
    return { accepted: [], rejected: [] };
  }

  const acknowledgedIds = new Set([
    ...response.accepted,
    ...response.rejected.map(({ id }) => id),
  ]);

  await taskDb.transaction('rw', taskDb.outbox, async () => {
    await Promise.all(
      dueMutations
        .filter(({ id }) => acknowledgedIds.has(id))
        .map(({ id }) => taskDb.outbox.delete(id)),
    );
  });

  return response;
}
