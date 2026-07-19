# Final review fix report

## Scope

Fixed the three Important findings in the final review only: shared local-first task mutation handling, executable Calendar task context, and non-destructive Canvas refreshes.

## RED evidence

- `PlannerWorkspace` and `SubjectTaskQueue` each constructed a direct `POST /api/sync/tasks` request. Those writes never reached the authenticated Dexie task cache or durable outbox before transport.
- `calendarEntries` converted each task into a reduced title/link snippet, so Calendar could not reuse the canonical task controls.
- Canvas refresh used `upsert` for every imported assignment identity, overwriting a student's edited task fields.

## GREEN implementation

- Added `lib/sync/task-client.ts` and `useTaskSyncWorkspace`. The shared client path hydrates only the current user's cache, writes the cache plus outbox before transport, applies accepted/rejected responses without losing conflict state, and schedules safe retries. Today now uses the extracted service; Planner, Subjects, and Calendar use the hook.
- Calendar entries now carry the full `CachedTask`, while `CalendarWorkspace` renders each task through `TaskList`. Provider events remain read-only external links.
- Canvas now reads existing `user_id, source, source_id` identities and inserts only unseen assignments. Existing Canvas task context and canonical revision are untouched; only actual inserts count.

## Regressions

- `task-client.test.ts`: an offline completion remains user-scoped in cache and outbox through hydration/reload.
- `calendar-workspace.test.tsx`: Calendar renders description/source/link/completion through canonical TaskList and keeps an event read-only.
- `canvas-input.test.ts`: a known Canvas identity is not inserted on refresh, preserving edited context.
- Updated Planner, Subject, and task-context coverage for the shared workflow.

## Final verification

- `npm run test` — 38 files passed, 123 tests passed, 2 skipped.
- `npm run lint` — passed.
- `npm run build` — passed.
- `npm run test:e2e` — 4 fixture-gated tests skipped; no failures.

## Self-review / minor findings

- No direct task-sync POST remains outside the shared client service.
- Canvas preserves existing rows rather than attempting provider-field updates, which intentionally prioritizes user edits and canonical revision safety.
- No schema, master-reset SQL, protected untracked instructions, or fixture directories were changed.
