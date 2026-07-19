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
      get: vi.fn(async (id: string) => outbox.get(id)),
      count: vi.fn(async () => outbox.size),
    },
    transaction: vi.fn(async (_mode: string, _table: unknown, callback: () => Promise<void>) => callback()),
  },
}));

import { discardTaskConflict, enqueueTaskMutation, flushTaskOutbox, resolveTaskConflict, retryTaskOutbox } from '../../lib/sync/outbox';

const validTask = {
  title: 'Write reflection',
  kind: 'school' as const,
  priority: 'normal' as const,
  description: '',
  links: [],
};
const userId = '0f0d1d8d-4d3b-4d97-b9e3-5f2d6e2a9b4f';
const taskId = 'f8e5cb4d-2dd4-4d63-a9d1-5af4c3b1d7f0';

describe('task mutation outbox', () => {
  beforeEach(() => {
    outbox.clear();
    vi.clearAllMocks();
  });

  it('keeps a mutation until the server acknowledges it', async () => {
    await enqueueTaskMutation({ id: 'm1', userId, operation: 'upsert', payload: validTask, baseUpdatedAt: null });

    await flushTaskOutbox(userId, async () => ({ accepted: [], rejected: [] }));
    expect(outbox.size).toBe(1);

    await flushTaskOutbox(userId, async () => ({ accepted: [{ id: 'm1', task: { id: taskId, title: 'Write reflection', kind: 'school', priority: 'normal', description: '', links: [], updatedAt: '2026-07-19T10:00:00.000Z', source: 'manual', sourceId: null } }], rejected: [] }));
    expect(outbox.size).toBe(0);
  });

  it('defers a network failure with exponential backoff', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    await enqueueTaskMutation({ id: 'm1', userId, operation: 'upsert', payload: validTask, baseUpdatedAt: null });

    const response = await flushTaskOutbox(userId, async () => {
      throw new Error('offline');
    });

    expect(outbox.get('m1')).toMatchObject({ attempts: 1, nextAttemptAt: 3_000 });
    expect(response.networkError).toBe(true);
    now.mockRestore();
  });

  it('retains a terminal rejection with its user-safe reason', async () => {
    await enqueueTaskMutation({ id: 'm1', userId, operation: 'upsert', payload: validTask, baseUpdatedAt: null });

    const response = await flushTaskOutbox(userId, async () => ({
      accepted: [],
      rejected: [{ id: 'm1', reason: 'Task belongs to another user.', syncState: 'rejected' }],
    }));

    expect(outbox.get('m1')).toMatchObject({
      syncState: 'rejected',
      syncError: 'Task belongs to another user.',
    });
    expect(response.rejected).toEqual([expect.objectContaining({ id: 'm1', taskId: undefined })]);
  });

  it('returns the affected task id for a rejection whose mutation id differs', async () => {
    await enqueueTaskMutation({ id: 'mutation-1', userId, operation: 'upsert', payload: { ...validTask, id: taskId }, baseUpdatedAt: '2026-07-19T09:00:00.000Z' });

    const response = await flushTaskOutbox(userId, async () => ({
      accepted: [],
      rejected: [{ id: 'mutation-1', reason: 'This task changed on another device.', syncState: 'conflict' }],
    }));

    expect(response.rejected).toEqual([expect.objectContaining({ id: 'mutation-1', taskId })]);
    expect(outbox.get('mutation-1')).toMatchObject({ syncState: 'conflict' });
  });

  it('does not requeue a conflict through generic retry', async () => {
    await enqueueTaskMutation({ id: 'm1', userId, operation: 'upsert', payload: { ...validTask, id: taskId }, baseUpdatedAt: '2026-07-19T09:00:00.000Z', syncState: 'conflict', syncError: 'Review required.' });

    await retryTaskOutbox(userId);

    expect(outbox.get('m1')).toMatchObject({ syncState: 'conflict', syncError: 'Review required.' });
  });

  it('keeps the latest payload and rebases an edit queued while an older mutation is in flight', async () => {
    await enqueueTaskMutation({ id: 'm1', userId, operation: 'upsert', payload: { ...validTask, id: taskId, title: 'Older edit' }, baseUpdatedAt: '2026-07-19T09:00:00.000Z' });

    await flushTaskOutbox(userId, async () => {
      await enqueueTaskMutation({ id: 'm2', userId, operation: 'upsert', payload: { ...validTask, id: taskId, title: 'Latest edit' }, baseUpdatedAt: '2026-07-19T10:00:00.000Z' });
      return {
        accepted: [{ id: 'm1', task: { id: taskId, title: 'Older edit', kind: 'school', priority: 'normal', description: '', links: [], updatedAt: '2026-07-19T11:00:00.000Z', source: 'manual', sourceId: null } }],
        rejected: [],
      };
    });

    expect(outbox.get('m2')).toMatchObject({
      payload: expect.objectContaining({ title: 'Latest edit' }),
      baseUpdatedAt: '2026-07-19T11:00:00.000Z',
    });
  });

  it('serializes same-task retries while an older request is in flight', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    await enqueueTaskMutation({ id: 'm1', userId, operation: 'upsert', payload: { ...validTask, id: taskId, title: 'Older edit' }, baseUpdatedAt: '2026-07-19T09:00:00.000Z' });

    let rejectRequest: (reason?: unknown) => void = () => undefined;
    let markRequestStarted: () => void = () => undefined;
    const requestStarted = new Promise<void>((resolve) => {
      markRequestStarted = resolve;
    });
    const firstFlush = flushTaskOutbox(userId, async (mutations) => {
      expect(mutations.map((mutation) => mutation.id)).toEqual(['m1']);
      markRequestStarted();
      return new Promise((_, reject) => {
        rejectRequest = reject;
      });
    });

    await requestStarted;
    await enqueueTaskMutation({ id: 'm2', userId, operation: 'upsert', payload: { ...validTask, id: taskId, title: 'Latest edit' }, baseUpdatedAt: '2026-07-19T10:00:00.000Z' });
    const secondFetcher = vi.fn(async () => ({ accepted: [], rejected: [] }));
    await flushTaskOutbox(userId, secondFetcher);
    expect(secondFetcher).not.toHaveBeenCalled();

    rejectRequest(new Error('offline'));
    const failure = await firstFlush;
    expect(failure).toMatchObject({ networkError: true, nextRetryAt: 3_000 });
    expect(outbox.get('m1')).toMatchObject({ attempts: 1, nextAttemptAt: 3_000, inFlight: false });
    expect(outbox.get('m2')).toMatchObject({ payload: expect.objectContaining({ title: 'Latest edit' }), nextAttemptAt: 1_000, inFlight: false });

    await flushTaskOutbox(userId, secondFetcher);
    expect(secondFetcher).not.toHaveBeenCalled();

    now.mockReturnValue(3_000);
    await flushTaskOutbox(userId, async () => ({
      accepted: [{ id: 'm1', task: { id: taskId, title: 'Older edit', kind: 'school', priority: 'normal', description: '', links: [], updatedAt: '2026-07-19T11:00:00.000Z', source: 'manual', sourceId: null } }],
      rejected: [],
    }));
    expect(outbox.get('m2')).toMatchObject({ baseUpdatedAt: '2026-07-19T11:00:00.000Z' });

    await flushTaskOutbox(userId, async (mutations) => {
      expect(mutations.map((mutation) => mutation.id)).toEqual(['m2']);
      return { accepted: [{ id: 'm2', task: { id: taskId, title: 'Latest edit', kind: 'school', priority: 'normal', description: '', links: [], updatedAt: '2026-07-19T12:00:00.000Z', source: 'manual', sourceId: null } }], rejected: [] };
    });
    expect(outbox.size).toBe(0);
    now.mockRestore();
  });

  it('keeps later edits pending behind a conflict and sends them after Keep local resolves the head', async () => {
    const serverTask = {
      id: taskId,
      title: 'Server edit',
      kind: 'school' as const,
      priority: 'normal' as const,
      description: '',
      links: [],
      updatedAt: '2026-07-19T11:00:00.000Z',
      source: 'manual',
      sourceId: null,
    };
    await enqueueTaskMutation({ id: 'm1', userId, operation: 'upsert', payload: { ...validTask, id: taskId, title: 'First local edit' }, baseUpdatedAt: '2026-07-19T09:00:00.000Z', createdAt: 1 });
    await enqueueTaskMutation({ id: 'm2', userId, operation: 'upsert', payload: { ...validTask, id: taskId, title: 'Second local edit' }, baseUpdatedAt: '2026-07-19T09:00:00.000Z', createdAt: 2 });

    await flushTaskOutbox(userId, async (mutations) => {
      expect(mutations.map((mutation) => mutation.id)).toEqual(['m1']);
      return { accepted: [], rejected: [{ id: 'm1', reason: 'This task changed on another device.', syncState: 'conflict', task: serverTask }] };
    });

    expect(outbox.get('m1')).toMatchObject({ syncState: 'conflict', canonicalTask: serverTask });
    expect(outbox.get('m2')).toMatchObject({ syncState: 'pending', payload: expect.objectContaining({ title: 'Second local edit' }) });
    const blockedFetcher = vi.fn(async () => ({ accepted: [], rejected: [] }));
    await flushTaskOutbox(userId, blockedFetcher);
    expect(blockedFetcher).not.toHaveBeenCalled();

    await resolveTaskConflict(userId, 'm1', { ...validTask, id: taskId, title: 'First local edit' });
    await flushTaskOutbox(userId, async (mutations) => {
      expect(mutations.map((mutation) => mutation.id)).toEqual(['m1']);
      return { accepted: [{ id: 'm1', task: { ...serverTask, title: 'First local edit', updatedAt: '2026-07-19T12:00:00.000Z' } }], rejected: [] };
    });

    expect(outbox.get('m2')).toMatchObject({ syncState: 'pending', baseUpdatedAt: '2026-07-19T12:00:00.000Z' });
    await flushTaskOutbox(userId, async (mutations) => {
      expect(mutations.map((mutation) => mutation.id)).toEqual(['m2']);
      return { accepted: [{ id: 'm2', task: { ...serverTask, title: 'Second local edit', updatedAt: '2026-07-19T13:00:00.000Z' } }], rejected: [] };
    });
    expect(outbox.size).toBe(0);
  });

  it('preserves and rebases later edits when Use latest server version resolves a conflict', async () => {
    const serverTask = {
      id: taskId,
      title: 'Server edit',
      kind: 'school' as const,
      priority: 'normal' as const,
      description: '',
      links: [],
      updatedAt: '2026-07-19T11:00:00.000Z',
      source: 'manual',
      sourceId: null,
    };
    await enqueueTaskMutation({ id: 'm1', userId, operation: 'upsert', payload: { ...validTask, id: taskId, title: 'First local edit' }, baseUpdatedAt: '2026-07-19T09:00:00.000Z', createdAt: 1 });
    await enqueueTaskMutation({ id: 'm2', userId, operation: 'upsert', payload: { ...validTask, id: taskId, title: 'Second local edit' }, baseUpdatedAt: '2026-07-19T09:00:00.000Z', createdAt: 2 });
    await flushTaskOutbox(userId, async () => ({
      accepted: [],
      rejected: [{ id: 'm1', reason: 'This task changed on another device.', syncState: 'conflict', task: serverTask }],
    }));

    await discardTaskConflict(userId, 'm1');
    expect(outbox.get('m1')).toMatchObject({ syncState: 'rejected' });
    expect(outbox.get('m2')).toMatchObject({ syncState: 'pending', baseUpdatedAt: serverTask.updatedAt });
    await flushTaskOutbox(userId, async (mutations) => {
      expect(mutations.map((mutation) => mutation.id)).toEqual(['m2']);
      return { accepted: [{ id: 'm2', task: { ...serverTask, title: 'Second local edit', updatedAt: '2026-07-19T12:00:00.000Z' } }], rejected: [] };
    });
    expect(outbox.get('m1')).toMatchObject({ syncState: 'rejected' });
    expect(outbox.has('m2')).toBe(false);
  });

});
