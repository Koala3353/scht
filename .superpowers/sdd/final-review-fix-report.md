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

## Second final-review fix wave

### RED evidence

- Project assignment bypassed the shared local-first task flow through `/api/projects`, so it had neither an outbox mutation nor conditional task revision.
- Planner fetched only 200 tasks while treating the response as safe to prune cached task rows.
- Canvas used a read-then-insert sequence, allowing two automatic page refreshes to race into a duplicate-key failure.

### GREEN implementation and regressions

- `WorkManager` now sends the full canonical task and `updatedAt` base revision to Planner's shared task save callback. `/api/projects` retains only project lifecycle mutations. Planner coverage proves project assignment creates a shared task mutation, remains cached/outboxed offline, and retains a conflict for review.
- Planner no longer limits the server task query and explicitly disables pruning from its non-authoritative projection. The >200 partial-snapshot regression keeps a synced cached task beyond the first 200 rows.
- Canvas now uses atomic `upsert(..., { onConflict: "user_id,source,source_id", ignoreDuplicates: true })`, which maps to conflict-ignore behavior and returns only rows inserted by that request. The concurrent-refresh regression verifies both requests return 200 and count one insert total.

### Second-wave final verification

- `npm run test` — 38 files passed, 127 tests passed, 2 skipped.
- `npm run lint` — passed.
- `npm run build` — passed.
- `npm run test:e2e` — 4 fixture-gated tests skipped; no failures.
