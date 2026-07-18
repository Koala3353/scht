# Scht product design

**Date:** 2026-07-18

## Purpose

Scht is an invite-only, installable school-and-work planner. It gives each user one reliable view of current commitments while retaining course history, grades, notes, syllabus context, and work tasks. It works on desktop and mobile, stays useful offline, and synchronizes through the user's account.

## Product principles

- Show the smallest useful set of information first: the current academic year and term scope the default experience.
- Treat school and work as one day without flattening their distinct contexts.
- Preserve user agency: imports, syllabus extraction, AI changes, and grade-weight mappings require review before becoming authoritative.
- Work offline without losing edits; make sync state visible.
- Use AI as a cost-conscious assistant, not an opaque automatic actor.
- Protect account data, while acknowledging the product owner's requested standing admin visibility through explicit disclosure and audit logs.

## Architecture

The application is a Next.js TypeScript PWA deployed on Vercel. GitHub is the source repository: pull requests run automated checks and receive Vercel previews; approved changes merged to `main` deploy production.

Supabase provides Google OAuth and magic-link authentication, Postgres data, private object storage, row-level security, server-side functions, and admin-role enforcement. The PWA caches workspace data in IndexedDB and writes locally first. A persistent mutation queue synchronizes on reconnect. The client shows `Offline`, `Syncing`, `Synced`, or `Needs review`; timestamp-only conflicts resolve automatically and material conflicts open a comparison screen.

Apps Script is a separately deployable reminder companion. A central owner-managed script dispatches user reminders from a limited batch queue. Each user may alternatively connect a personal companion that sends only their own reminders. The central script checks remaining quota, applies batch and run caps, adds jitter, respects time zones and quiet hours, retries transient failures exponentially, and defers overflow. Each dispatch has an idempotency key, preventing duplicate reminders.

## Authentication, roles, and secrets

The primary sign-in is Google, with magic-link email as a fallback. Registration is invite-only. A user accepts a clear data-access disclosure during onboarding.

Ordinary users access only their own workspace through Supabase RLS. The owner-admin role has standing visibility into individual content, invitation management, system controls, and exports. Every admin read of personal content, export, change, and support action is written to an immutable audit record containing the admin, action, target, purpose, and timestamp.

Google and Canvas authorization material is never returned to the UI after storage. User-provided GPT and Hack Club AI keys are encrypted client-side using a user-created vault passphrase. Supabase stores ciphertext only; the passphrase is entered on each device to unlock the vault. Admins cannot read decrypted AI keys.

## Core data

### Academic records

- `academic_years` and `terms` define selectable year/semester scopes.
- `curriculum_items` retain parsed IPS year, term, course code, units, category, requirement, override-prerequisite status, and completion status.
- `subjects` represent courses a user activates, with term, professor notes, course links, Canvas mapping, syllabus status, and archive state.
- `syllabi` are private files with extraction results, validation state, and a user-approved assessment-weight mapping.
- `grade_categories` and `assessment_results` calculate course standing and grade scenarios from approved weights.

### Planning records

- `tasks` are a unified school/work/personal model with source, due date, effort, priority, completion, links, notes, and subject or project association.
- `projects`, `notes`, and `workspaces` preserve work context without mixing it into course records.
- `calendar_events` and imported task mappings retain source IDs to avoid duplicates.
- `ai_conversations` retain relevant context, proposal previews, and application history.

### Operations records

- `integration_connections`, `sync_runs`, and `sync_errors` track provider state and recovery guidance.
- `reminder_preferences`, `reminder_queue`, and `reminder_deliveries` handle schedules and idempotency.
- `invites`, `roles`, `global_settings`, `feature_flags`, `admin_audit_logs`, and provider health records power administration.

## User experience

The home screen is agenda-first. The header provides an accessible current term selector. Today, Subjects, Grades, Canvas imports, and syllabus work are filtered to that term by default. Past and future terms remain searchable through an explicit scope filter and never crowd the daily workspace.

Desktop uses a readable navigation rail; mobile uses a fixed, large-touch-target bottom bar. Navigation labels, icon buttons, and mobile controls use enlarged typography and hit areas. The visual system uses a deep teal application shell, soft neutral canvas, rounded white surfaces, and a warm orange reserved for high-priority actions.

Main user screens are:

1. **Today:** prioritized agenda combining school, work, and personal items; next-focus card; sync state; high-weight assignment cues.
2. **Planner and Calendar:** task and time views with term, source, subject, status, and priority filters.
3. **Subjects:** active-term courses first; professor notes, Canvas state, syllabus state, grade summary, and assignments per course.
4. **Grades:** category weights, assessment results, source syllabus context, and scenarios.
5. **Work:** projects and work tasks that also appear in Today when relevant.
6. **AI:** constrained chat that proposes changes and requires a review-and-apply step for every write.
7. **Settings:** theme, integrations, current term, AI vault, Hack Club setup, data export, and reminders.

The first-run flow is: accept invitation, sign in, create a vault passphrase, choose integrations, paste IPS, select the current academic year/term, activate subjects, add professor notes, upload syllabi, review assessment-weight mappings, and land in Today.

## Integrations and automation

Google Calendar and Gmail use explicit OAuth consent. Canvas uses a user-provided base URL and API token. Connections have clear states: connected, syncing, needs reauthorization, or error; imported records remain available if a connection fails.

The syllabus workflow stores the original private file, extracts candidate assessment categories and weights, matches candidates to Canvas assignments where possible, and presents a review screen. Weight totals that do not equal 100%, ambiguous mappings, or missing values are flagged. No grade calculation uses a candidate mapping until the user approves it.

The AI provider adapter supports OpenAI and Hack Club AI. Settings include a short, accurate Hack Club setup guide: create an API key in the Hack Club AI dashboard, store it in the encrypted vault, and use its OpenAI-compatible proxy endpoint. AI requests send only the smallest relevant context, prefer economical models for extraction and classification, cache safe parse results, and require confirmation for bulk writes. Each assignment can create a copyable AI-task prompt based on approved task, syllabus, grade, and note context.

## Admin dashboard

The owner-admin dashboard includes:

- Aggregate usage, invite/active-user counts, task volume, storage, sync health, feature usage, reminder delivery, sender quota, and provider health.
- User and invitation management, roles, standing workspace inspection, export tools, and a complete audit trail.
- Central reminder schedule, batch caps, quiet hours, retry policy, Apps Script configuration, and delivery failure review.
- Global feature settings, provider toggles, maintenance notices, data retention controls, and security-event views.

## Failure behavior

- Offline edits remain local until acknowledged by Supabase.
- Revoked or expired integrations pause only the related import and give a reconnect action.
- Failed syllabus parsing creates a recoverable draft, never an incorrect grade weight.
- AI failures return a retryable state and never cause partial writes.
- Reminder jobs check quotas before sending; unmet capacity is deferred with a visible admin reason.
- No destructive user or admin change occurs without a confirmation surface; audit logs are append-only.

## Verification

Automated tests cover IPS parsing, active-term filtering, grade math, syllabus mapping validation, AI prompt generation, reminder batching and idempotency, provider adapters, Supabase RLS, invite authorization, and audit logging. End-to-end tests cover mobile and desktop flows, installability, offline mutations and reconnect, first-run onboarding, integration reauthorization, reminder controls, and admin access. GitHub CI executes the test suite and lint/type checks; Vercel preview deployments support review before production merges.
