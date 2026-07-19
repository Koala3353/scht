import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { candidateWeightsAreComplete, extractCandidateWeights } from '../../lib/syllabus/weights';
import { SubjectTaskQueue } from '../../components/subjects/subject-task-queue';
import type { CachedTask } from '../../lib/sync/types';

const cachedTasks = new Map<string, Record<string, unknown>>();
const queuedMutations = new Map<string, Record<string, unknown>>();

vi.mock('../../lib/sync/db', () => ({
  taskDb: {
    tasks: {
      where: vi.fn(() => ({ equals: vi.fn((userId: string) => ({ toArray: vi.fn(async () => [...cachedTasks.values()].filter((task) => task.userId === userId)) })) })),
      get: vi.fn(async (id: string) => cachedTasks.get(id)),
      put: vi.fn(async (task: Record<string, unknown>) => { cachedTasks.set(task.id as string, task); }),
      bulkPut: vi.fn(async (items: Record<string, unknown>[]) => { items.forEach((task) => cachedTasks.set(task.id as string, task)); }),
      update: vi.fn(async (id: string, changes: Record<string, unknown>) => { cachedTasks.set(id, { ...cachedTasks.get(id), ...changes }); }),
      delete: vi.fn(async (id: string) => { cachedTasks.delete(id); }),
    },
    outbox: {
      where: vi.fn(() => ({ equals: vi.fn((userId: string) => ({ toArray: vi.fn(async () => [...queuedMutations.values()].filter((mutation) => mutation.userId === userId)) })) })),
      get: vi.fn(async (id: string) => queuedMutations.get(id)),
      put: vi.fn(async (mutation: Record<string, unknown>) => { queuedMutations.set(mutation.id as string, mutation); }),
      update: vi.fn(async (id: string, changes: Record<string, unknown>) => { queuedMutations.set(id, { ...queuedMutations.get(id), ...changes }); }),
      delete: vi.fn(async (id: string) => { queuedMutations.delete(id); }),
    },
    transaction: vi.fn(async (_mode: string, _table: unknown, callback: () => Promise<unknown>) => callback()),
  },
}));

afterEach(() => {
  cleanup();
  cachedTasks.clear();
  queuedMutations.clear();
  vi.unstubAllGlobals();
});

describe('syllabus assessment weights', () => {
  it('extracts category weights and requires an exact 100% total for approval', () => {
    const weights = extractCandidateWeights('Quizzes - 20%\nExams: 50%\nFinal project 30%');
    expect(weights).toEqual([{ name: 'Quizzes', weightPercent: 20 }, { name: 'Exams', weightPercent: 50 }, { name: 'Final project', weightPercent: 30 }]);
    expect(candidateWeightsAreComplete(weights)).toBe(true);
  });
  it('keeps the next subject assignment executable with canonical task controls', async () => {
    const task: CachedTask = { id: 'task-1', userId: 'user-1', title: 'Research reflection', kind: 'school', dueAt: '2026-07-24T09:30:00.000Z', priority: 'normal', termId: 'term-1', subjectId: 'subject-1', projectId: null, weightPercent: 20, description: 'Use class readings.', links: [], effortMinutes: null, completedAt: null, updatedAt: '2026-07-19T00:00:00.000Z', syncState: 'synced', source: 'canvas', sourceId: 'canvas-1' };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { mutations: Array<{ id: string; payload: CachedTask }> };
      return { ok: true, json: async () => ({ accepted: [{ id: body.mutations[0]?.id, task: body.mutations[0]?.payload }], rejected: [] }) } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    render(createElement(SubjectTaskQueue, { approvedCategoryLabels: ['Reflections'], currentTermId: 'term-1', initialTasks: [task], projects: [], representedSubjectId: 'subject-1', subjects: [{ id: 'subject-1', termId: 'term-1', label: 'HIST 101 · History' }], terms: [{ id: 'term-1', label: 'Fall 2026' }], userId: 'user-1' }));
    const user = userEvent.setup();

    expect(screen.getByRole('heading', { name: 'Next open assignment' })).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Edit Research reflection' }));
    expect(screen.getByLabelText('Due date and time')).not.toBeNull();
    await user.clear(screen.getByLabelText('Due date and time'));
    await user.type(screen.getByLabelText('Due date and time'), '2026-07-25T13:30');
    await user.click(screen.getByRole('button', { name: 'Save task' }));
    await user.click(screen.getByRole('button', { name: 'Complete Research reflection' }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('removes an accepted reassignment from the represented subject queue', async () => {
    const task: CachedTask = { id: 'task-1', userId: 'user-1', title: 'Research reflection', kind: 'school', dueAt: '2026-07-24T09:30:00.000Z', priority: 'normal', termId: 'term-1', subjectId: 'subject-1', projectId: null, weightPercent: 20, description: '', links: [], effortMinutes: null, completedAt: null, updatedAt: '2026-07-19T00:00:00.000Z', syncState: 'synced', source: 'manual', sourceId: null };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { mutations: Array<{ id: string; payload: CachedTask }> };
      return { ok: true, json: async () => ({ accepted: [{ id: body.mutations[0]?.id, task: body.mutations[0]?.payload }], rejected: [] }) } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    render(createElement(SubjectTaskQueue, { approvedCategoryLabels: ['Reflections'], currentTermId: 'term-1', initialTasks: [task], projects: [], representedSubjectId: 'subject-1', subjects: [{ id: 'subject-1', termId: 'term-1', label: 'HIST 101 · History' }, { id: 'subject-2', termId: 'term-1', label: 'LIT 102 · Literature' }], terms: [{ id: 'term-1', label: 'Fall 2026' }], userId: 'user-1' }));
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Edit Research reflection' }));
    await user.selectOptions(screen.getByLabelText('Subject'), 'subject-2');
    await user.click(screen.getByRole('button', { name: 'Save task' }));

    await waitFor(() => expect(screen.getByText('No open tasks.')).not.toBeNull());
    expect(screen.queryByRole('button', { name: 'Copy AI starter prompt' })).toBeNull();
    expect(screen.queryByText('Reflections')).toBeNull();
  });
});
