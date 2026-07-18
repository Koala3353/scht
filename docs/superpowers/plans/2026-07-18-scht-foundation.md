# Scht Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the invite-only, offline-capable Scht PWA foundation with authenticated users, current-term scoped planning, IPS import, and the responsive agenda-first experience.

**Architecture:** Next.js App Router provides the PWA user interface and server endpoints, deployed by Vercel. Supabase owns identity, persistent workspace data, RLS, and private storage; Dexie IndexedDB owns the local-first task cache and mutation outbox. Server-only Supabase access is isolated in route handlers and never exposed to the browser.

**Tech Stack:** Next.js + TypeScript + Tailwind CSS, React, Supabase SSR, PostgreSQL migrations, Dexie, Zod, Lucide React, Vitest, Testing Library, Playwright, GitHub Actions, Vercel.

## Global Constraints

- Use TypeScript strict mode; do not use `any` in application code.
- Keep all ordinary user reads/writes behind Supabase RLS; only the `owner_admin` role has standing cross-user access.
- The default academic scope is the selected current year and term; history appears only through an explicit filter.
- Mobile controls must have at least a 44px hit target; navigation labels and icons are intentionally large.
- Persist task edits in IndexedDB before attempting network synchronization and surface the sync state in the UI.
- Store no provider secrets or user AI keys in the browser-accessible database.
- Validate all external and form data with Zod.
- Add an automated test before each behavioral implementation change and commit each completed task.

---

## File structure

```
app/
  (app)/layout.tsx                     Authenticated app shell and term provider
  (app)/today/page.tsx                 Current-term agenda page
  (app)/onboarding/page.tsx            Invite acceptance and workspace setup
  (admin)/admin/page.tsx               Owner dashboard summary
  auth/callback/route.ts               Supabase OAuth callback
  api/sync/tasks/route.ts              Authenticated mutation-outbox endpoint
  manifest.ts                          Web app manifest
  globals.css                          Theme tokens and accessible base styles
components/
  layout/app-shell.tsx                 Desktop rail and mobile tab navigation
  layout/term-switcher.tsx             Selected year/term control
  today/agenda.tsx                     Agenda timeline presentation
  today/focus-card.tsx                 Next high-impact task card
  onboarding/ips-import.tsx            Curriculum paste-and-preview UI
lib/
  auth/guards.ts                       Server role and session helpers
  curriculum/ips-parser.ts             Pure IPS parser
  curriculum/types.ts                  Curriculum and term domain types
  sync/db.ts                           Dexie schema and local task cache
  sync/outbox.ts                       Queue and retry helpers
  sync/types.ts                        Serialized mutation contracts
  supabase/client.ts                   Browser Supabase client
  supabase/server.ts                   Server Supabase client
  validation/task.ts                   Zod task schemas
supabase/migrations/
  0001_foundation.sql                  Tables, RLS, policies, indexes, audit trigger
tests/
  unit/ips-parser.test.ts              Parser cases
  unit/outbox.test.ts                  Local queue cases
  unit/task-schema.test.ts             Validation cases
  integration/rls.test.ts              Role isolation tests
  e2e/onboarding.spec.ts               Invite, term, IPS journey
  e2e/today-offline.spec.ts            Offline task creation and restore
```

## Task 1: Create the Next.js PWA workspace

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `app/manifest.ts`, `public/icon-192.png`, `public/icon-512.png`
- Create: `.env.example`, `.github/workflows/ci.yml`, `vitest.config.ts`, `playwright.config.ts`
- Test: `tests/unit/app-shell.test.tsx`

**Interfaces:**
- Produces `npm run lint`, `npm run test`, `npm run test:e2e`, and `npm run build` commands used by every later task.
- Produces `AppMetadata` through `app/manifest.ts` for installable PWA behavior.

- [ ] **Step 1: Scaffold the app and install runtime/test dependencies**

Run:
```bash
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir=false --use-npm --import-alias '@/*'
npm install @supabase/ssr @supabase/supabase-js dexie zod lucide-react clsx tailwind-merge
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event playwright
```

Expected: `package.json` contains `dev`, `build`, `lint`, and `test` scripts and the app starts with `npm run dev`.

- [ ] **Step 2: Write the failing manifest test**

```tsx
// tests/unit/app-shell.test.tsx
import manifest from '@/app/manifest';

it('declares a standalone installable application', () => {
  expect(manifest.display).toBe('standalone');
  expect(manifest.name).toBe('Scht');
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: '192x192' }),
  ]));
});
```

- [ ] **Step 3: Implement the manifest and theme foundation**

```ts
// app/manifest.ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Scht', short_name: 'Scht', start_url: '/today',
    display: 'standalone', background_color: '#f4f7f7', theme_color: '#075e60',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
```

Define `--teal: #075e60`, `--canvas: #f4f7f7`, `--ink: #172233`, `--orange: #d65a13`, and a 44px `--touch-target` in `app/globals.css`. Set metadata in `app/layout.tsx` to use the manifest and `viewport.themeColor`.

- [ ] **Step 4: Run the test and build**

Run: `npm run test -- tests/unit/app-shell.test.tsx && npm run build`

Expected: test passes and Next.js produces a production build.

- [ ] **Step 5: Add CI and commit**

Create `.github/workflows/ci.yml` with checkout, Node LTS setup, `npm ci`, `npm run lint`, `npm run test`, and `npm run build`. Then run:
```bash
git add package.json package-lock.json app public tests vitest.config.ts playwright.config.ts .github .env.example
git commit -m "feat: scaffold Scht PWA"
```

## Task 2: Define the Supabase foundation and role boundary

**Files:**
- Create: `supabase/migrations/0001_foundation.sql`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/auth/guards.ts`
- Create: `lib/curriculum/types.ts`, `lib/validation/task.ts`
- Test: `tests/unit/task-schema.test.ts`, `tests/integration/rls.test.ts`

**Interfaces:**
- Produces `requireUser(): Promise<{ id: string; role: 'member' | 'owner_admin' }>`.
- Produces `TaskInputSchema` and `TaskInput` used by the sync route and agenda.
- Produces tables `profiles`, `invites`, `academic_terms`, `subjects`, `tasks`, `curriculum_items`, and `admin_audit_logs`.

- [ ] **Step 1: Write failing validation tests**

```ts
import { TaskInputSchema } from '@/lib/validation/task';

it('requires a task title and ISO due date when provided', () => {
  expect(() => TaskInputSchema.parse({ title: '', kind: 'school' })).toThrow();
  expect(TaskInputSchema.parse({ title: 'Quant set', kind: 'school', dueAt: '2026-07-18T12:00:00.000Z' }).title).toBe('Quant set');
});
```

- [ ] **Step 2: Implement domain types and validation**

```ts
// lib/validation/task.ts
import { z } from 'zod';
export const TaskInputSchema = z.object({
  id: z.string().uuid().optional(), title: z.string().trim().min(1).max(180),
  kind: z.enum(['school', 'work', 'personal']), dueAt: z.string().datetime().nullable().optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  termId: z.string().uuid().nullable().optional(), subjectId: z.string().uuid().nullable().optional(),
  weightPercent: z.number().min(0).max(100).nullable().optional(), completedAt: z.string().datetime().nullable().optional(),
});
export type TaskInput = z.infer<typeof TaskInputSchema>;
```

- [ ] **Step 3: Add the migration with RLS**

The migration must enable RLS on every user table, use `auth.uid() = user_id` for member policies, and use `public.is_owner_admin()` for owner policies. Include a `profiles` trigger created on `auth.users` insert, an invite table keyed by normalized email, a unique `(user_id, starts_on)` academic-term index, and an `admin_audit_logs` insert-only table. Include this policy shape for `tasks`:

```sql
create policy "users manage own tasks" on public.tasks
for all using (auth.uid() = user_id or public.is_owner_admin())
with check (auth.uid() = user_id or public.is_owner_admin());
```

- [ ] **Step 4: Implement Supabase clients and guard**

`lib/auth/guards.ts` must redirect unauthenticated requests to `/`, query `profiles.role`, and throw a 403 response for an admin-only route when role is not `owner_admin`. Browser client uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; server client reads cookies through `@supabase/ssr`.

- [ ] **Step 5: Run validation and migration-policy tests**

Run: `npm run test -- tests/unit/task-schema.test.ts tests/integration/rls.test.ts`

Expected: invalid data is rejected; tests prove a member cannot select another member's task and an owner admin can.

- [ ] **Step 6: Commit**

```bash
git add supabase lib tests
git commit -m "feat: add Supabase workspace foundation"
```

## Task 3: Build invite-only authentication and current-term onboarding

**Files:**
- Create: `app/auth/callback/route.ts`, `app/(app)/onboarding/page.tsx`, `components/layout/term-switcher.tsx`, `components/onboarding/ips-import.tsx`
- Modify: `app/page.tsx`, `app/(app)/layout.tsx`
- Test: `tests/e2e/onboarding.spec.ts`, `tests/unit/term-switcher.test.tsx`

**Interfaces:**
- Consumes `requireUser`, `academic_terms`.
- Produces `selectedTermId` stored in `profiles.current_term_id` and exposed by `TermSwitcher`.

- [ ] **Step 1: Write failing current-term selector test**

```tsx
it('calls onChange with the selected term id', async () => {
  const onChange = vi.fn();
  render(<TermSwitcher terms={[{ id: 't1', label: '2026–2027 · First Semester' }]} value="t1" onChange={onChange} />);
  await userEvent.selectOptions(screen.getByLabelText('Current academic term'), 't1');
  expect(onChange).toHaveBeenCalledWith('t1');
});
```

- [ ] **Step 2: Implement invite gate and OAuth callback**

`app/page.tsx` accepts an email, checks that an unused invite exists before calling `signInWithOtp`, and offers Google OAuth using `signInWithOAuth({ provider: 'google', options: { redirectTo: origin + '/auth/callback' } })`. The callback exchanges the code, rejects users without a matching accepted invite or `owner_admin` role, and redirects accepted users to `/onboarding` until `profiles.onboarding_completed_at` is set.

- [ ] **Step 3: Implement term selection and onboarding form**

`TermSwitcher` renders a labelled `<select>` with labels in the exact form `2026–2027 · First Semester`; it has a minimum 44px height. Onboarding creates the current academic year and term, saves it to `profiles.current_term_id`, then redirects to the curriculum-import step implemented in Task 4. Do not include historical terms in Today until the user selects them.

- [ ] **Step 4: Run component and e2e tests**

Run: `npm run test -- tests/unit/term-switcher.test.tsx && npx playwright test tests/e2e/onboarding.spec.ts`

Expected: invite-only user reaches onboarding, chooses a term, and reaches the curriculum-import step.

- [ ] **Step 5: Commit**

```bash
git add app components tests
git commit -m "feat: add invite onboarding and term selection"
```

## Task 4: Parse and persist IPS curriculum imports

**Files:**
- Create: `lib/curriculum/ips-parser.ts`, `tests/unit/ips-parser.test.ts`
- Modify: `components/onboarding/ips-import.tsx`, `supabase/migrations/0001_foundation.sql`

**Interfaces:**
- Produces `parseIps(input: string): ParsedCurriculumItem[]`.
- `ParsedCurriculumItem` is `{ academicYear: number; term: 'Intersession' | 'First Semester' | 'Second Semester'; status: string; courseCode: string; units: number; category: string; required: boolean; prerequisiteOverride: boolean }`.

- [ ] **Step 1: Write parser tests using the supplied IPS structure**

```ts
it('parses semester rows and ignores total/unit summary lines', () => {
  const rows = parseIps('First Year\nFirst Semester\nP ENLIT 12 3 C Y N\nUnits Taken: 23.00');
  expect(rows).toEqual([expect.objectContaining({ academicYear: 1, term: 'First Semester', courseCode: 'ENLIT 12', units: 3, status: 'P' })]);
});
```

- [ ] **Step 2: Implement a line-state parser**

Maintain `currentYear` from `First|Second|Third|Fourth Year`; maintain `currentTerm` from `Intersession|First Semester|Second Semester`; skip headers and lines beginning `Units Taken:`. Split rows from the right: final three tokens are category, required, and override; the token before category is units; all preceding tokens after status form `courseCode`, allowing entries such as `NSTP 11(CWTS)` and `ANALYTICS ELECTIVE`.

- [ ] **Step 3: Add import preview and transaction**

The importer displays parsed count, invalid-line count, and a table restricted to the selected current term by default. A user must select `Import N courses`; use an upsert keyed by `(user_id, academic_year, term, course_code)`. Preserve parsed status and do not auto-create `subjects` until the user marks a curriculum item active.

- [ ] **Step 4: Run parser and UI tests**

Run: `npm run test -- tests/unit/ips-parser.test.ts tests/unit/term-switcher.test.tsx`

Expected: all supplied row variations parse correctly and blank/summary lines do not create records.

- [ ] **Step 5: Commit**

```bash
git add lib components supabase tests
git commit -m "feat: import IPS curriculum data"
```

## Task 5: Add IndexedDB task cache and synchronization outbox

**Files:**
- Create: `lib/sync/types.ts`, `lib/sync/db.ts`, `lib/sync/outbox.ts`, `app/api/sync/tasks/route.ts`
- Test: `tests/unit/outbox.test.ts`, `tests/e2e/today-offline.spec.ts`

**Interfaces:**
- Produces `taskDb.tasks`, `taskDb.outbox`, `enqueueTaskMutation(mutation)`, and `flushTaskOutbox(fetcher)`.
- Consumes `TaskInputSchema` and responds from `/api/sync/tasks` with `{ accepted: string[]; rejected: Array<{ id: string; reason: string }> }`.

- [ ] **Step 1: Write failing outbox tests**

```ts
it('keeps a mutation until the server acknowledges it', async () => {
  await enqueueTaskMutation({ id: 'm1', operation: 'upsert', payload: validTask });
  await flushTaskOutbox(async () => ({ accepted: [], rejected: [] }));
  expect(await taskDb.outbox.count()).toBe(1);
  await flushTaskOutbox(async () => ({ accepted: ['m1'], rejected: [] }));
  expect(await taskDb.outbox.count()).toBe(0);
});
```

- [ ] **Step 2: Implement Dexie schema and outbox**

Use Dexie tables `tasks: 'id,termId,dueAt,updatedAt,completedAt'` and `outbox: 'id,createdAt,nextAttemptAt'`. An outbox record contains `{ id, operation, payload, createdAt, attempts, nextAttemptAt }`. `flushTaskOutbox` processes due mutations in created order, retains network failures, and increases `nextAttemptAt` by `min(300000, 1000 * 2 ** attempts)`.

- [ ] **Step 3: Implement authenticated sync route**

The route requires a user, parses each payload with `TaskInputSchema`, forces `user_id` from the session, and upserts tasks. It returns per-mutation rejection reasons instead of failing the entire batch. It must not accept a caller-supplied `user_id`.

- [ ] **Step 4: Run unit and offline browser tests**

Run: `npm run test -- tests/unit/outbox.test.ts && npx playwright test tests/e2e/today-offline.spec.ts`

Expected: a task created while offline appears immediately, survives reload, and syncs once the browser reconnects.

- [ ] **Step 5: Commit**

```bash
git add lib app tests
git commit -m "feat: add offline task synchronization"
```

## Task 6: Deliver the responsive agenda-first workspace

**Files:**
- Create: `app/(app)/today/page.tsx`, `components/layout/app-shell.tsx`, `components/today/agenda.tsx`, `components/today/focus-card.tsx`
- Modify: `app/(app)/layout.tsx`, `app/globals.css`
- Test: `tests/unit/agenda.test.tsx`, `tests/e2e/today-offline.spec.ts`

**Interfaces:**
- Consumes `selectedTermId`, cached tasks, and `TaskInput`.
- Produces `Agenda({ tasks, onComplete })` and `FocusCard({ task })`.

- [ ] **Step 1: Write failing agenda behavior test**

```tsx
it('shows only current-term tasks and marks high-weight work', () => {
  render(<Agenda tasks={[currentHighWeightTask, previousTermTask]} onComplete={vi.fn()} />);
  expect(screen.getByText('Quant 121 — problem set')).toBeVisible();
  expect(screen.getByText('HIGH IMPACT · 25%')).toBeVisible();
  expect(screen.queryByText(previousTermTask.title)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Implement application shell**

Create an accessible desktop rail with Today, Planner, Calendar, Subjects, Grades, Work, and Settings. At mobile widths, replace it with a fixed tab bar for Today, Planner, add task, Calendar, and More. Each item has `min-height: var(--touch-target)`, a visible label, and a Lucide icon sized at least 22px. Use deep teal navigation, neutral canvas, rounded white cards, and orange only for priority/primary actions.

- [ ] **Step 3: Implement Today, focus selection, and task completion**

Sort incomplete selected-term tasks by due time, then high priority, then descending `weightPercent`. `FocusCard` chooses the first task with a positive weight, otherwise the first agenda task. Completing a task updates Dexie, queues an `upsert` mutation, and updates the timeline without waiting for the network.

- [ ] **Step 4: Run UI and e2e tests**

Run: `npm run test -- tests/unit/agenda.test.tsx && npx playwright test tests/e2e/today-offline.spec.ts`

Expected: both desktop and mobile navigation are usable, the selected term scopes the agenda, and completion remains local offline.

- [ ] **Step 5: Commit**

```bash
git add app components tests
git commit -m "feat: add term-scoped responsive agenda"
```

## Task 7: Provide the initial owner dashboard and release checks

**Files:**
- Create: `app/(admin)/admin/page.tsx`, `components/admin/metric-card.tsx`, `components/admin/recent-audit-log.tsx`
- Modify: `lib/auth/guards.ts`, `.env.example`, `README.md`
- Test: `tests/unit/admin-guard.test.ts`, `tests/e2e/admin.spec.ts`

**Interfaces:**
- Consumes `requireUser()` and `admin_audit_logs`.
- Produces an owner-only `/admin` page with active-user, task-count, sync-state, and audit metrics.

- [ ] **Step 1: Write failing access test**

```ts
it('rejects a member from an owner-only page', async () => {
  mockCurrentRole('member');
  await expect(requireOwnerAdmin()).rejects.toMatchObject({ status: 403 });
});
```

- [ ] **Step 2: Implement the owner guard and dashboard query**

Add `requireOwnerAdmin()` to `lib/auth/guards.ts`. The server page calls it before querying aggregate counts and the latest 20 audit entries. Render four metric cards: active users, current-term tasks, sync failures, and pending invites. Do not render individual task content in this first dashboard; the later operations plan adds auditable workspace inspection.

- [ ] **Step 3: Document local and Vercel configuration**

`.env.example` must list `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_APP_URL` with empty values. `README.md` documents Supabase migration application, Vercel environment-variable configuration, GitHub preview deployment, and the command sequence `npm ci`, `npm run test`, `npm run build`.

- [ ] **Step 4: Run release checks**

Run:
```bash
npm run lint
npm run test
npx playwright test
npm run build
```

Expected: all commands exit 0; a member is forbidden from `/admin`; an owner sees aggregate metrics.

- [ ] **Step 5: Commit**

```bash
git add app components lib tests .env.example README.md
git commit -m "feat: add owner dashboard foundation"
```

## Follow-on plans

After this plan ships, create and execute two separate plans:

1. `scht-academics-integrations`: active-subject management, professor notes, syllabus private uploads and reviewed weight mappings, grade scenarios, Canvas, Google Calendar, and Gmail adapters.
2. `scht-automation-operations`: encrypted AI vault and OpenAI/Hack Club adapters, AI proposal chat and prompt generator, central/personal Apps Script companions, full admin operations, quota telemetry, and export/audit workflows.

## Plan self-review

- **Spec coverage in this plan:** PWA installation, GitHub/Vercel workflow, invite auth, Supabase/RLS, current-term scope, IPS import, mobile/desktop agenda, offline IndexedDB sync, foundation admin metrics, testing, and release verification are covered by Tasks 1–7.
- **Explicitly sequenced work:** subject/grade/syllabus workflows, provider integrations, AI vault, reminder dispatch, and complete owner operations are isolated into the two named follow-on plans because they are independently testable systems.
- **Type consistency:** `TaskInput`, `selectedTermId`, `parseIps`, task outbox mutation contracts, `requireUser`, and `requireOwnerAdmin` are introduced before their consuming tasks.
- **Placeholder scan:** no incomplete implementation markers remain; every implementation task includes files, interfaces, test behavior, commands, and commit boundaries.
