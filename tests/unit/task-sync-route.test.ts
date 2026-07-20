import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
  insertSelect: vi.fn(),
  insertSingle: vi.fn(),
  update: vi.fn(),
  updateMaybeSingle: vi.fn(),
  canonicalMaybeSingle: vi.fn(),
}));

vi.mock('../../lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

import { POST } from '../../app/api/sync/tasks/route';

const userId = '0f0d1d8d-4d3b-4d97-b9e3-5f2d6e2a9b4f';
const taskId = 'f8e5cb4d-2dd4-4d63-a9d1-5af4c3b1d7f0';
const updatedAt = '2026-07-19T10:00:00.000Z';

const row = {
  id: taskId,
  user_id: userId,
  title: 'Submit reflection',
  kind: 'school' as const,
  due_at: null,
  priority: 'high' as const,
  term_id: null,
  subject_id: null,
  project_id: null,
  weight_percent: null,
  notes: 'Use the lecture notes.',
  links: ['https://canvas.example.edu/courses/1/assignments/2'],
  effort_minutes: 45,
  completed_at: null,
  updated_at: updatedAt,
  source: 'canvas',
  source_id: 'course:assignment',
};

function request(mutations: unknown) {
  return new Request('http://localhost/api/sync/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mutations }),
  });
}

function mutation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mutation-1',
    userId,
    operation: 'upsert',
    baseUpdatedAt: null,
    payload: {
      id: taskId,
      title: 'Submit reflection',
      kind: 'school',
      priority: 'high',
      description: 'Use the lecture notes.',
      links: ['https://canvas.example.edu/courses/1/assignments/2'],
      effortMinutes: 45,
    },
    ...overrides,
  };
}

describe('POST /api/sync/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insert.mockReturnValue({ select: mocks.insertSelect });
    mocks.insertSelect.mockReturnValue({ single: mocks.insertSingle });
    mocks.insertSingle.mockResolvedValue({ data: row, error: null });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });
  });

  it('requires an authenticated user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST(request([]));

    expect(response.status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('writes task context under the authenticated mutation owner', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mocks.from.mockReturnValue({ insert: mocks.insert });

    const response = await POST(request([mutation({ payload: { ...mutation().payload, user_id: '6ed78831-33e5-4af2-99e0-5142e0c0b84c' } })]));

    expect(await response.json()).toEqual({
      accepted: [{ id: 'mutation-1', task: expect.objectContaining({ id: taskId, description: 'Use the lecture notes.', source: 'canvas', sourceId: 'course:assignment' }) }],
      rejected: [],
    });
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: userId, notes: 'Use the lecture notes.', effort_minutes: 45 }),
    );
  });

  it('rejects an account-crossing mutation before any database write', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });

    const response = await POST(request([mutation({ userId: '6ed78831-33e5-4af2-99e0-5142e0c0b84c' })]));

    expect(await response.json()).toEqual({
      accepted: [],
      rejected: [{ id: 'mutation-1', reason: 'This mutation belongs to another account.', syncState: 'rejected' }],
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('reports a missing owned task when a direct Supabase update finds no row', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    const updateChain = {
      eq: vi.fn(),
      select: vi.fn(),
    };
    updateChain.eq.mockReturnValue(updateChain);
    updateChain.select.mockReturnValue({ maybeSingle: mocks.updateMaybeSingle });
    mocks.update.mockReturnValue(updateChain);
    mocks.updateMaybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.from.mockReturnValueOnce({ update: mocks.update });

    const response = await POST(request([mutation({ baseUpdatedAt: updatedAt })]));

    expect(await response.json()).toEqual({
      accepted: [],
      rejected: [{
        id: 'mutation-1',
        reason: 'This task no longer exists or you no longer have access to it.',
        syncState: 'rejected',
        taskId,
      }],
    });
    expect(updateChain.eq).not.toHaveBeenCalledWith('updated_at', updatedAt);
  });

  it('repairs oversized legacy Canvas descriptions while completing the task', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    const updateChain = { eq: vi.fn(), select: vi.fn() };
    updateChain.eq.mockReturnValue(updateChain);
    updateChain.select.mockReturnValue({ maybeSingle: mocks.updateMaybeSingle });
    mocks.update.mockReturnValue(updateChain);
    mocks.updateMaybeSingle.mockResolvedValue({ data: row, error: null });
    mocks.from.mockReturnValueOnce({ update: mocks.update });
    const legacyDescription = 'x'.repeat(5_001);

    const response = await POST(request([mutation({
      baseUpdatedAt: updatedAt,
      payload: { ...mutation().payload, source: 'canvas', description: legacyDescription, completedAt: '2026-07-20T12:00:00.000Z' },
    })]));

    expect(await response.json()).toEqual({ accepted: [expect.objectContaining({ id: 'mutation-1' })], rejected: [] });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ notes: legacyDescription.slice(0, 5_000) }));
  });
});
