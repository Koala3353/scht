import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock('../../lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { seedDemoWorkspace } from '../../app/api/dev/demo-login/route';

const userId = '0f0d1d8d-4d3b-4d97-b9e3-5f2d6e2a9b4f';
const termId = 'f8e5cb4d-2dd4-4d63-a9d1-5af4c3b1d7f0';

describe('development demo workspace seed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provisions the fixed owner profile before inserting its first term', async () => {
    const operations: string[] = [];
    const profileUpsert = vi.fn(async (row: Record<string, unknown>) => {
      operations.push('profile-upsert');
      expect(row).toEqual({
        id: userId,
        display_name: 'Scht demo user',
        role: 'owner_admin',
      });
      return { error: null };
    });
    const profileUpdate = vi.fn((row: Record<string, unknown>) => ({
      eq: vi.fn(async (column: string, value: string) => {
        operations.push('profile-update');
        expect(column).toBe('id');
        expect(value).toBe(userId);
        expect(row).toMatchObject({ current_term_id: termId });
        return { error: null };
      }),
    }));
    const termInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { id: termId }, error: null })),
      })),
    }));
    const existingTerm = {
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })),
        })),
      })),
    };

    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'profiles') return { upsert: profileUpsert, update: profileUpdate };
        if (table === 'academic_terms') return { select: vi.fn(() => existingTerm), insert: (...args: unknown[]) => { operations.push('term-insert'); return termInsert(...args); } };
        if (table === 'subjects') {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(async () => ({ data: [{ id: 'subject-1' }], error: null })) })) })) };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await seedDemoWorkspace(userId);

    expect(operations).toEqual(['profile-upsert', 'term-insert', 'profile-update']);
    expect(operations.indexOf('profile-upsert')).toBeLessThan(operations.indexOf('term-insert'));
  });
});
