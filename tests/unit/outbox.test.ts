import { beforeEach, describe, expect, it, vi } from 'vitest';

const outbox = new Map<string, Record<string, unknown>>();

vi.mock('../../lib/sync/db', () => ({
  taskDb: {
    outbox: {
      put: vi.fn(async (mutation: Record<string, unknown>) => {
        outbox.set(mutation.id as string, mutation);
      }),
      where: vi.fn(() => ({
        belowOrEqual: vi.fn(() => ({
          sortBy: vi.fn(async () =>
            [...outbox.values()]
              .filter((mutation) => (mutation.nextAttemptAt as number) <= Date.now())
              .sort((first, second) => (first.createdAt as number) - (second.createdAt as number)),
          ),
        })),
      })),
      update: vi.fn(async (id: string, changes: Record<string, unknown>) => {
        outbox.set(id, { ...outbox.get(id), ...changes });
      }),
      delete: vi.fn(async (id: string) => {
        outbox.delete(id);
      }),
      count: vi.fn(async () => outbox.size),
    },
    transaction: vi.fn(async (_mode: string, _table: unknown, callback: () => Promise<void>) => callback()),
  },
}));

import { enqueueTaskMutation, flushTaskOutbox } from '../../lib/sync/outbox';

const validTask = {
  title: 'Write reflection',
  kind: 'school' as const,
  priority: 'normal' as const,
};

describe('task mutation outbox', () => {
  beforeEach(() => {
    outbox.clear();
    vi.clearAllMocks();
  });

  it('keeps a mutation until the server acknowledges it', async () => {
    await enqueueTaskMutation({ id: 'm1', operation: 'upsert', payload: validTask });

    await flushTaskOutbox(async () => ({ accepted: [], rejected: [] }));
    expect(outbox.size).toBe(1);

    await flushTaskOutbox(async () => ({ accepted: ['m1'], rejected: [] }));
    expect(outbox.size).toBe(0);
  });

  it('defers a network failure with exponential backoff', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    await enqueueTaskMutation({ id: 'm1', operation: 'upsert', payload: validTask });

    await flushTaskOutbox(async () => {
      throw new Error('offline');
    });

    expect(outbox.get('m1')).toMatchObject({ attempts: 1, nextAttemptAt: 3_000 });
    now.mockRestore();
  });

  it('removes terminally rejected mutations so they do not retry forever', async () => {
    await enqueueTaskMutation({ id: 'm1', operation: 'upsert', payload: validTask });

    await flushTaskOutbox(async () => ({
      accepted: [],
      rejected: [{ id: 'm1', reason: 'Task belongs to another user.' }],
    }));

    expect(outbox.size).toBe(0);
  });
});
