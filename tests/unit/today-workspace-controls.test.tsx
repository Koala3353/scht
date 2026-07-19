import { render, screen, waitFor, within } from '@testing-library/react';
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

  it('lets a rejected saved change be edited and explicitly resubmitted', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ accepted: [], rejected: [] }) })));
    const rejected = task({ syncState: 'rejected', syncError: 'Description is required.', description: '' });
    outbox.set('m1', { id: 'm1', userId, operation: 'upsert', payload: rejected, baseUpdatedAt: rejected.updatedAt, createdAt: 1, attempts: 0, nextAttemptAt: 0, syncState: 'rejected' });
    const view = render(<TodayWorkspace initialTasks={[rejected]} selectedTermId={termId} userId={userId} />);
    const workspace = within(view.container);

    await userEvent.click(workspace.getByRole('button', { name: 'Edit and resubmit' }));
    expect(workspace.getByRole('dialog', { name: 'Edit and resubmit saved change' })).not.toBeNull();
    const title = workspace.getByLabelText('Title');
    await userEvent.clear(title);
    await userEvent.type(title, 'Corrected task title');
    await userEvent.type(workspace.getByLabelText('Description'), 'Required context');
    await userEvent.click(workspace.getByRole('button', { name: 'Resubmit saved change' }));

    await waitFor(() => expect(outbox.get('m1')).toMatchObject({
      syncState: 'pending',
      payload: expect.objectContaining({ title: 'Corrected task title', description: 'Required context' }),
    }));
    vi.unstubAllGlobals();
  });

  it('offers confirmed discard or recreate recovery when the server task is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ accepted: [], rejected: [] }) })));
    const missing = task({ syncState: 'conflict', syncError: 'This task changed on another device.' });
    outbox.set('m1', { id: 'm1', userId, operation: 'upsert', payload: missing, baseUpdatedAt: missing.updatedAt, createdAt: 1, attempts: 0, nextAttemptAt: 0, syncState: 'conflict' });
    const view = render(<TodayWorkspace initialTasks={[missing]} selectedTermId={termId} userId={userId} />);
    const workspace = within(view.container);

    expect(workspace.getByRole('button', { name: 'Discard local change' })).not.toBeNull();
    expect(workspace.getByRole('button', { name: 'Recreate as new task' })).not.toBeNull();
    expect(workspace.queryByRole('button', { name: 'Keep my version' })).toBeNull();
    expect(workspace.queryByRole('button', { name: 'Use latest server version' })).toBeNull();

    await userEvent.click(workspace.getByRole('button', { name: 'Recreate as new task' }));
    expect(workspace.getByRole('button', { name: 'Confirm recreate as new task' })).not.toBeNull();
    await userEvent.click(workspace.getByRole('button', { name: 'Confirm recreate as new task' }));
    await waitFor(() => expect([...outbox.values()]).toEqual(expect.arrayContaining([
      expect.objectContaining({ baseUpdatedAt: null, syncState: 'pending', payload: expect.objectContaining({ id: expect.any(String) }) }),
    ])));
    expect(outbox.get('m1')).toMatchObject({ recoveryResolved: true });
    vi.unstubAllGlobals();
  });
});
