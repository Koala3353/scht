import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CachedTask } from '../../lib/sync/types';

const tasks = new Map<string, CachedTask>();
const outbox = new Map<string, Record<string, unknown>>();

function rowsForUser(userId: string) {
  return [...tasks.values()].filter((task) => task.userId === userId);
}

vi.mock('../../lib/sync/db', () => ({
  taskDb: {
    tasks: {
      where: vi.fn(() => ({ equals: vi.fn((userId: string) => ({ toArray: vi.fn(async () => rowsForUser(userId)) })) })),
      get: vi.fn(async (id: string) => tasks.get(id)),
      put: vi.fn(async (task: CachedTask) => { tasks.set(task.id, task); }),
      bulkPut: vi.fn(async (items: CachedTask[]) => { items.forEach((task) => tasks.set(task.id, task)); }),
      update: vi.fn(async (id: string, changes: Partial<CachedTask>) => { const task = tasks.get(id); if (task) tasks.set(id, { ...task, ...changes }); }),
      delete: vi.fn(async (id: string) => { tasks.delete(id); }),
    },
    outbox: {
      where: vi.fn(() => ({ equals: vi.fn(() => ({ toArray: vi.fn(async () => [...outbox.values()]) })) })),
      get: vi.fn(async (id: string) => outbox.get(id)),
      put: vi.fn(async (mutation: Record<string, unknown>) => { outbox.set(mutation.id as string, mutation); }),
      update: vi.fn(async (id: string, changes: Record<string, unknown>) => { outbox.set(id, { ...outbox.get(id), ...changes }); }),
      delete: vi.fn(async (id: string) => { outbox.delete(id); }),
    },
    transaction: vi.fn(async (_mode: string, _table: unknown, callback: () => Promise<void>) => callback()),
  },
}));

import { TodayWorkspace } from '../../components/today/today-workspace';

const userId = '0f0d1d8d-4d3b-4d97-b9e3-5f2d6e2a9b4f';
const termId = 'f8e5cb4d-2dd4-4d63-a9d1-5af4c3b1d7f0';

function task(overrides: Partial<CachedTask> = {}): CachedTask {
  return {
    id: 'f11c73a2-24b7-40ee-88fd-d7bf9a203420',
    userId,
    title: 'Local draft',
    kind: 'school',
    dueAt: null,
    priority: 'normal',
    termId,
    subjectId: null,
    projectId: null,
    weightPercent: null,
    description: '',
    links: [],
    effortMinutes: null,
    completedAt: null,
    updatedAt: '2026-07-19T10:00:00.000Z',
    syncState: 'conflict',
    syncError: 'This task changed on another device.',
    source: 'manual',
    sourceId: null,
    ...overrides,
  };
}

describe('TodayWorkspace sync review controls', () => {
  beforeEach(() => {
    tasks.clear();
    outbox.clear();
    vi.clearAllMocks();
  });

  it('keeps the local conflict visible until the user explicitly confirms a resolution', async () => {
    const local = task({ canonicalTask: { ...task(), title: 'Server version', updatedAt: '2026-07-19T11:00:00.000Z' } });
    outbox.set('m1', { id: 'm1', userId, operation: 'upsert', payload: local, baseUpdatedAt: local.updatedAt, createdAt: 1, attempts: 0, nextAttemptAt: 0, syncState: 'conflict', canonicalTask: local.canonicalTask });
    render(<TodayWorkspace initialTasks={[local]} selectedTermId={termId} userId={userId} />);

    expect(screen.getByRole('button', { name: 'Keep my version' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Use latest server version' })).not.toBeNull();
    expect(screen.queryByText('Server version')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Keep my version' }));
    expect(screen.getByRole('button', { name: 'Confirm keeping my version' })).not.toBeNull();
    expect(screen.getAllByText('Local draft').length).toBeGreaterThan(0);
  });

  it('gives a rejected saved change an explicit retry action', () => {
    render(<TodayWorkspace initialTasks={[task({ syncState: 'rejected', syncError: 'Save rejected.' })]} selectedTermId={termId} userId={userId} />);

    expect(screen.getByRole('button', { name: 'Retry saved change' })).not.toBeNull();
  });
});
