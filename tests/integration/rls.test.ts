import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(
  path.resolve(testDirectory, '../../supabase/migrations/0001_foundation.sql'),
  'utf8',
);
const scopedReferenceMigration = readFileSync(
  path.resolve(
    testDirectory,
    '../../supabase/migrations/0002_validate_scoped_reference_owners.sql',
  ),
  'utf8',
);
const masterReset = readFileSync(
  path.resolve(testDirectory, '../../supabase/master_reset.sql'),
  'utf8',
);

function policySql(name: string, table: string): string {
  const start = migration.indexOf(`create policy "${name}" on public.${table}`);
  const end = migration.indexOf(';', start);

  if (start < 0 || end < 0) {
    throw new Error(`Missing ${name} policy on ${table}`);
  }

  return migration.slice(start, end + 1).replace(/\s+/g, ' ');
}

const liveRlsEnvironment = {
  url: process.env.SUPABASE_RLS_TEST_URL,
  anonKey: process.env.SUPABASE_RLS_TEST_ANON_KEY,
  memberToken: process.env.SUPABASE_RLS_TEST_MEMBER_TOKEN,
  otherMemberToken: process.env.SUPABASE_RLS_TEST_OTHER_MEMBER_TOKEN,
  ownerToken: process.env.SUPABASE_RLS_TEST_OWNER_TOKEN,
  otherMemberTaskId: process.env.SUPABASE_RLS_TEST_OTHER_MEMBER_TASK_ID,
};

const hasLiveRlsEnvironment = Object.values(liveRlsEnvironment).every(Boolean);
const describeLiveRls = hasLiveRlsEnvironment ? describe : describe.skip;

const liveReferenceTriggerEnvironment = {
  url: process.env.SUPABASE_RLS_TEST_URL,
  anonKey: process.env.SUPABASE_RLS_TEST_ANON_KEY,
  ownerToken: process.env.SUPABASE_RLS_TEST_OWNER_TOKEN,
  memberId: process.env.SUPABASE_RLS_TEST_MEMBER_ID,
  memberTermId: process.env.SUPABASE_RLS_TEST_MEMBER_TERM_ID,
  memberOtherTermId: process.env.SUPABASE_RLS_TEST_MEMBER_OTHER_TERM_ID,
  memberSubjectId: process.env.SUPABASE_RLS_TEST_MEMBER_SUBJECT_ID,
  otherMemberTermId: process.env.SUPABASE_RLS_TEST_OTHER_MEMBER_TERM_ID,
  otherMemberSubjectId: process.env.SUPABASE_RLS_TEST_OTHER_MEMBER_SUBJECT_ID,
};

const hasLiveReferenceTriggerEnvironment = Object.values(
  liveReferenceTriggerEnvironment,
).every(Boolean);
const describeLiveReferenceTriggers = hasLiveReferenceTriggerEnvironment
  ? describe
  : describe.skip;

describe('row-level security migration contract', () => {
  it('enables RLS and scopes every workspace table to its owner with an explicit owner override', () => {
    for (const table of [
      'profiles',
      'invites',
      'academic_terms',
      'subjects',
      'tasks',
      'curriculum_items',
      'admin_audit_logs',
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security;`);
    }

    const ownerScopedPolicy =
      'for all using (auth.uid() = user_id or public.is_owner_admin()) with check (auth.uid() = user_id or public.is_owner_admin());';

    for (const [name, table] of [
      ['users manage own academic terms', 'academic_terms'],
      ['users manage own subjects', 'subjects'],
      ['users manage own tasks', 'tasks'],
      ['users manage own curriculum items', 'curriculum_items'],
    ]) {
      expect(policySql(name, table)).toContain(ownerScopedPolicy);
    }
  });

  it('rolls out cross-profile term and subject checks in an additive migration', () => {
    const validationFunction = scopedReferenceMigration.slice(
      scopedReferenceMigration.indexOf(
        'create or replace function public.validate_scoped_reference_owners()',
      ),
      scopedReferenceMigration.indexOf('drop trigger if exists subjects_validate_term_owner'),
    );

    expect(validationFunction).toContain('security definer');
    expect(validationFunction).toContain(
      'where id = new.term_id and user_id = new.user_id',
    );
    expect(validationFunction).toContain(
      'where id = new.subject_id and user_id = new.user_id',
    );
    expect(validationFunction).toContain(
      "message = 'Term reference must belong to the same profile'",
    );
    expect(validationFunction).toContain(
      "message = 'Subject reference must belong to the same profile'",
    );
    expect(validationFunction).toContain(
      "message = 'Subject reference must belong to the selected term'",
    );

    for (const [table, trigger] of [
      ['subjects', 'subjects_validate_term_owner'],
      ['tasks', 'tasks_validate_reference_owners'],
      ['curriculum_items', 'curriculum_items_validate_reference_owners'],
    ]) {
      expect(scopedReferenceMigration).toContain(
        `drop trigger if exists ${trigger} on public.${table};`,
      );
      expect(scopedReferenceMigration).toContain(`create trigger ${trigger}`);
    }
  });
});

describe('master reset row-level security contract', () => {
  it('restores owner-aware policies and a private, one-use owner bootstrap', () => {
    for (const table of [
      'profiles',
      'academic_terms',
      'subjects',
      'curriculum_items',
      'tasks',
      'projects',
      'syllabi',
      'grade_categories',
      'assessment_results',
      'calendar_events',
      'integration_connections',
      'encrypted_ai_vaults',
      'reminder_preferences',
      'reminder_queue',
      'sync_errors',
    ]) {
      expect(masterReset).toContain(
        `alter table public.${table} enable row level security;`,
      );
    }

    expect(masterReset).toContain(
      'create policy "users view own reminder deliveries" on public.reminder_deliveries',
    );
    expect(masterReset).toContain('revoke all on table private.bootstrap_owner');
    expect(masterReset).toContain('delete from private.bootstrap_owner');
    expect(masterReset).toContain("'owner_admin'::public.profile_role");
  });
});

describeLiveRls('deployed task row-level security', () => {
  it('hides another member task, rejects writes to it, and permits the owner-admin override', async () => {
    const { url, anonKey, memberToken, otherMemberToken, ownerToken, otherMemberTaskId } =
      liveRlsEnvironment as Record<string, string>;

    const member = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${memberToken}` } },
    });
    const otherMember = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${otherMemberToken}` } },
    });
    const owner = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${ownerToken}` } },
    });

    const hiddenTask = await member
      .from('tasks')
      .select('id')
      .eq('id', otherMemberTaskId)
      .maybeSingle();
    expect(hiddenTask.error).toBeNull();
    expect(hiddenTask.data).toBeNull();

    const deniedUpdate = await member
      .from('tasks')
      .update({ title: 'RLS mutation must not be visible' })
      .eq('id', otherMemberTaskId)
      .select('id');
    expect(deniedUpdate.error).toBeNull();
    expect(deniedUpdate.data).toEqual([]);

    const otherMemberTask = await otherMember
      .from('tasks')
      .select('id')
      .eq('id', otherMemberTaskId)
      .single();
    expect(otherMemberTask.error).toBeNull();
    expect(otherMemberTask.data?.id).toBe(otherMemberTaskId);

    const ownerTask = await owner
      .from('tasks')
      .select('id')
      .eq('id', otherMemberTaskId)
      .single();
    expect(ownerTask.error).toBeNull();
    expect(ownerTask.data?.id).toBe(otherMemberTaskId);
  });
});

describeLiveReferenceTriggers('deployed scoped-reference triggers', () => {
  it('rejects cross-owner and mismatched references even for owner-admin writes', async () => {
    const {
      url,
      anonKey,
      ownerToken,
      memberId,
      memberTermId,
      memberOtherTermId,
      memberSubjectId,
      otherMemberTermId,
      otherMemberSubjectId,
    } = liveReferenceTriggerEnvironment as Record<string, string>;

    const owner = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${ownerToken}` } },
    });
    const nonce = crypto.randomUUID();

    async function expectRejectedWrite(
      write: PromiseLike<{ error: { code?: string; message: string } | null }>,
      code: string,
      message: string,
    ) {
      const result = await write;
      expect(result.error?.code).toBe(code);
      expect(result.error?.message).toContain(message);
    }

    await expectRejectedWrite(
      owner.from('subjects').insert({
        user_id: memberId,
        term_id: otherMemberTermId,
        code: `X-${nonce}`,
        name: 'Cross-owner subject',
      }),
      '23503',
      'Term reference must belong to the same profile',
    );

    await expectRejectedWrite(
      owner.from('tasks').insert({
        user_id: memberId,
        term_id: otherMemberTermId,
        subject_id: memberSubjectId,
        title: `Cross-owner task ${nonce}`,
        kind: 'school',
      }),
      '23503',
      'Term reference must belong to the same profile',
    );
    await expectRejectedWrite(
      owner.from('tasks').insert({
        user_id: memberId,
        term_id: memberTermId,
        subject_id: otherMemberSubjectId,
        title: `Cross-owner task subject ${nonce}`,
        kind: 'school',
      }),
      '23503',
      'Subject reference must belong to the same profile',
    );
    await expectRejectedWrite(
      owner.from('tasks').insert({
        user_id: memberId,
        term_id: memberOtherTermId,
        subject_id: memberSubjectId,
        title: `Mismatched task subject ${nonce}`,
        kind: 'school',
      }),
      '23514',
      'Subject reference must belong to the selected term',
    );

    await expectRejectedWrite(
      owner.from('curriculum_items').insert({
        user_id: memberId,
        term_id: otherMemberTermId,
        subject_id: memberSubjectId,
        course_code: `X-${nonce}`,
        units: 3,
      }),
      '23503',
      'Term reference must belong to the same profile',
    );
    await expectRejectedWrite(
      owner.from('curriculum_items').insert({
        user_id: memberId,
        term_id: memberTermId,
        subject_id: otherMemberSubjectId,
        course_code: `Y-${nonce}`,
        units: 3,
      }),
      '23503',
      'Subject reference must belong to the same profile',
    );
    await expectRejectedWrite(
      owner.from('curriculum_items').insert({
        user_id: memberId,
        term_id: memberOtherTermId,
        subject_id: memberSubjectId,
        course_code: `Z-${nonce}`,
        units: 3,
      }),
      '23514',
      'Subject reference must belong to the selected term',
    );
  });
});
