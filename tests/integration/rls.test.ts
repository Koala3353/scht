import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(
  path.resolve(testDirectory, '../../supabase/migrations/0001_foundation.sql'),
  'utf8',
);

describe('task row-level security migration', () => {
  it('prevents a member from selecting or changing another member task', () => {
    expect(migration).toContain('alter table public.tasks enable row level security;');
    expect(migration).toContain(
      'for all using (auth.uid() = user_id or public.is_owner_admin())',
    );
    expect(migration).toContain(
      'with check (auth.uid() = user_id or public.is_owner_admin());',
    );
  });

  it('permits the owner admin override used for support and administration', () => {
    expect(migration).toContain('create or replace function public.is_owner_admin()');
    expect(migration).toContain("where id = auth.uid() and role = 'owner_admin'");
    expect(migration).toContain('or public.is_owner_admin()');
  });
});
