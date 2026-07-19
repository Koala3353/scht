import { beforeEach, describe, expect, it, vi } from 'vitest';

const outbox = new Map<string, Record<string, unknown>>();

vi.mock('../../lib/sync/db', () => ({
  taskDb: {
    outbox: {
      put: vi.fn(async (mutation: Record<string, unknown>) => {
        outbox.set(mutation.id as string, mutation);
      }),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(async () => [...outbox.values()]),
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
  description: '',
  links: [],
};
const userId = '0f0d1d8d-4d3b-4d97-b9e3-5f2d6e2a9b4f';

describe('task mutation outbox', () => {
  beforeEach(() => {
    outbox.clear();
    vi.clearAllMocks();
  });

  it('keeps a mutation until the server acknowledges it', async () => {
    await enqueueTaskMutation({ id: 'm1', userId, operation: 'upsert', payload: validTask, baseUpdatedAt: null });

    await flushTaskOutbox(userId, async () => ({ accepted: [], rejected: [] }));
    expect(outbox.size).toBe(1);

    await flushTaskOutbox(userId, async () => ({ accepted: [{ id: 'm1', task: { id: 'task-1', title: 'Write reflection', kind: 'school', priority: 'normal', description: '', links: [], updatedAt: '2026-07-19T10:00:00.000Z' } }], rejected: [] }));
    expect(outbox.size).toBe(0);
  });

  it('defers a network failure with exponential backoff', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    await enqueueTaskMutation({ id: 'm1', userId, operation: 'upsert', payload: validTask, baseUpdatedAt: null });

    await flushTaskOutbox(userId, async () => {
      throw new Error('offline');
    });

    expect(outbox.get('m1')).toMatchObject({ attempts: 1, nextAttemptAt: 3_000 });
    now.mockRestore();
  });

  it('retains a terminal rejection with its user-safe reason', async () => {
    await enqueueTaskMutation({ id: 'm1', userId, operation: 'upsert', payload: validTask, baseUpdatedAt: null });

    await flushTaskOutbox(userId, async () => ({
      accepted: [],
      rejected: [{ id: 'm1', reason: 'Task belongs to another user.', syncState: 'rejected' }],
    }));

    expect(outbox.get('m1')).toMatchObject({
      syncState: 'rejected',
      syncError: 'Task belongs to another user.',
    });
  });
});
