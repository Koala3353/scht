# Task 7 report — compact destructive database reset

## Status

Complete. The reset is a manual artifact only. No live SQL, Supabase CLI command, migration application, database reset, Storage deletion, or other production-data operation was run during this task.

## RED / GREEN evidence

- **RED:** `npm run test -- tests/integration/master-reset-schema.test.ts` failed before the artifact existed with `ENOENT ... supabase/master_reset.sql`.
- **GREEN:** `npm run test -- tests/integration/master-reset-schema.test.ts tests/integration/rls.test.ts tests/unit/task-schema.test.ts tests/unit/integration-credentials.test.ts` passed: 4 files, 11 passed, 2 intentionally skipped live-RLS checks.

## Delivered files

- `supabase/master_reset.sql` — one transaction beginning with `begin;`, explicit destructive warning, Scht-only public-data and `syllabi`-object removal, compact schema, RLS, triggers, indexes, private bucket policies, and one-use owner bootstrap.
- `supabase/MASTER_RESET.md` — backup, literal owner-email replacement, new-owner signup/sign-in, and Supabase Dashboard SQL Editor procedure.
- `tests/integration/master-reset-schema.test.ts` — contract coverage for transaction, scope, compactness, RLS/indexes, private bucket, and bootstrap consumption.
- `tests/integration/rls.test.ts` — reset RLS/private-bootstrap assertions.
- `app/api/integrations/google/sync/route.ts` — stops writing provider payloads to calendar rows.
- `app/api/ai/propose/route.ts`, `app/api/ai/apply/route.ts` — AI proposals are ephemeral; only explicitly reviewed tasks are persisted.
- `app/api/admin/export/route.ts` — removes the deleted notes-table export and validates `userId` with Zod.
- `README.md`, `.env.example` — safe reset and environment guidance.

## Verification

- `npm run lint` — passed.
- `npm run build` — passed.
- `npm run test:e2e` — passed with 4 tests skipped by their configured environment guards.
- `npm run test` — 1 unrelated pre-existing/cross-task failure in `tests/unit/task-context.test.tsx`: it renders `SubjectTaskQueue` with stale `tasks` rather than required `initialTasks`, causing `tasks.filter` on `undefined`. Per coordinator direction, this Task 5 fixture was not changed by Task 7.
- Static review confirmed application table usage is covered by the reset and found no retained queries to `notes`, `ai_conversations`, `global_settings`, or `feature_flags`, nor a calendar payload write.

## Self-review and concerns

- The bootstrap owner must be a **new** Auth email. Auth is intentionally preserved, so an existing Auth user cannot fire the signup trigger after profiles are reset. The guide makes this explicit.
- The literal placeholder is deliberately invalid until replaced; this prevents accidental execution from committing destructive changes.
- SQL was reviewed statically only. The instructions prohibit executing it; an operator must perform a backup and review it in the correct Supabase Dashboard before manual use.

## Follow-up review remediation

- Reworked `handle_new_user` so ordinary Auth signups do not receive a member profile. It creates a profile only when the non-readable, exact bootstrap row is atomically consumed, preserving the one-owner bootstrap boundary.
- Reworked `accept_invite_for_current_user` into the only member recovery path. It locks the matching pending invite, creates a missing profile with that invite's role, then marks the invite accepted in the same database transaction. The function is `security definer` and executable only by `authenticated`; no profile-insert RLS policy is granted to PostgREST callers.
- Reordered `/auth/callback` to invoke the recovery RPC before reading/rejecting a missing profile. Retained Auth users are recoverable by re-inviting their existing email; no new credentials are required.
- Documented that recovery procedure in `supabase/MASTER_RESET.md` and extended static tests for callback ordering, atomic invite recovery, protected profile creation, required terminal `commit;`, and calendar writes without provider payloads.
- **GREEN (follow-up):** focused schema/RLS/auth test suite passed (5 files, 14 passed, 2 intentionally skipped live-RLS checks); `npm run lint` and `npm run build` passed. No live SQL, Supabase CLI command, migration application, database reset, or data deletion was executed.
