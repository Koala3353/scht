import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  forbidden: vi.fn((): never => {
    const error = Object.assign(new Error('NEXT_HTTP_ERROR_FALLBACK;403'), {
      digest: 'NEXT_HTTP_ERROR_FALLBACK;403',
    });
    throw error;
  }),
  redirect: vi.fn((): never => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('next/navigation', () => ({
  forbidden: mocks.forbidden,
  redirect: mocks.redirect,
}));

vi.mock('../../lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

import { requireOwnerAdmin } from '../../lib/auth/guards';

function mockAuthenticatedProfile(role: 'member' | 'owner_admin') {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { role }, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });

  mocks.createClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: '0f0d1d8d-4d3b-4d97-b9e3-5f2d6e2a9b4f' } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({ select }),
  });
}

describe('requireOwnerAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses Next.js forbidden interrupt for a member, which renders a 403 response', async () => {
    mockAuthenticatedProfile('member');

    await expect(requireOwnerAdmin()).rejects.toMatchObject({
      digest: 'NEXT_HTTP_ERROR_FALLBACK;403',
    });
    expect(mocks.forbidden).toHaveBeenCalledOnce();

    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const nextConfig = readFileSync(path.resolve(testDirectory, '../../next.config.ts'), 'utf8');
    expect(nextConfig).toContain('authInterrupts: true');
  });

  it('returns an owner-admin profile without invoking the forbidden interrupt', async () => {
    mockAuthenticatedProfile('owner_admin');

    await expect(requireOwnerAdmin()).resolves.toEqual({
      id: '0f0d1d8d-4d3b-4d97-b9e3-5f2d6e2a9b4f',
      role: 'owner_admin',
    });
    expect(mocks.forbidden).not.toHaveBeenCalled();
  });
});
