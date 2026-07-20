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

  it('uses the dedicated workspace-access failure path when the profile query errors', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'permission denied' },
    });
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

    await expect(
      requireOwnerAdmin({
        accessCheckFailureRedirect: '/admin/sign-in?error=workspace-access-check-failed',
      }),
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.redirect).toHaveBeenCalledWith(
      '/admin/sign-in?error=workspace-access-check-failed',
    );
  });

  it('seeds only the development demo account as an owner admin and gives the portal a dedicated sign-in path', () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const demoRoute = readFileSync(
      path.resolve(testDirectory, '../../app/api/dev/demo-login/route.ts'),
      'utf8',
    );
    const adminPage = readFileSync(
      path.resolve(testDirectory, '../../app/(admin)/admin/page.tsx'),
      'utf8',
    );

    expect(demoRoute).toContain("role: 'owner_admin'");
    expect(demoRoute).toContain("process.env.NODE_ENV === 'development'");
    expect(adminPage).toContain('await requireOwnerAdmin({');
    expect(adminPage).toContain('unauthenticatedRedirect: "/admin/sign-in?error=sign-in-required"');
    expect(adminPage).toContain('unauthorizedRedirect: "/admin/sign-in?error=not-owner"');
    expect(adminPage).toContain('accessCheckFailureRedirect: "/admin/sign-in?error=workspace-access-check-failed"');
  });
});
