import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('../../lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

import { POST } from '../../app/api/sync/tasks/route';

const userId = '0f0d1d8d-4d3b-4d97-b9e3-5f2d6e2a9b4f';
const taskId = 'f8e5cb4d-2dd4-4d63-a9d1-5af4c3b1d7f0';

function request(mutations: unknown) {
  return new Request('http://localhost/api/sync/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mutations }),
  });
}

describe('POST /api/sync/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ upsert: mocks.upsert });
    mocks.upsert.mockResolvedValue({ error: null });
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

  it('uses the session user instead of a caller-supplied user_id', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });

    const response = await POST(
      request([
        {
          id: 'mutation-1',
          operation: 'upsert',
          payload: {
            id: taskId,
            title: 'Submit reflection',
            kind: 'school',
            priority: 'high',
            user_id: '6ed78831-33e5-4af2-99e0-5142e0c0b84c',
          },
        },
      ]),
    );

    expect(await response.json()).toEqual({ accepted: ['mutation-1'], rejected: [] });
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: taskId, user_id: userId, title: 'Submit reflection' }),
      { onConflict: 'id' },
    );
  });

  it('reports an invalid mutation without rejecting the rest of the batch', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });

    const response = await POST(
      request([
        { id: 'bad', operation: 'upsert', payload: { title: '', kind: 'school' } },
        {
          id: 'good',
          operation: 'upsert',
          payload: { title: 'Read chapter', kind: 'school', priority: 'normal' },
        },
      ]),
    );

    const body = await response.json();
    expect(body.accepted).toEqual(['good']);
    expect(body.rejected).toEqual([expect.objectContaining({ id: 'bad' })]);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });
});
