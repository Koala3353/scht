# Scht

Scht is an invite-only academic workspace for Ateneo students: one calm place for classes, deadlines, grades, connected services, and next actions.

**Live app:** [scht-admu.vercel.app](https://scht-admu.vercel.app/)

## What Scht does

- Builds a current-term task view with offline task capture and sync. Offline access is limited to the loaded task workspace and queued changes; private pages and API responses are never cached by the service worker.
- Imports an IPS curriculum, tracks subjects, and calculates Ateneo QPI or a 4.0 GPA.
- Syncs Google Calendar events, unread Gmail follow-ups, and Canvas assignments when a student explicitly connects them.
- Sends accessible, mobile-friendly Apps Script task reminders plus configurable daily or weekly outlook emails.
- Lets students bring their own OpenAI or Hack Club AI key; AI can only propose tasks until the student reviews and applies them.
- Gives owner admins invitations, Google OAuth test-user links, operational metrics, audit history, and data export.

## Quick start

Requirements: Node.js 20+, npm, and a Supabase project.

```bash
git clone https://github.com/Koala3353/scht.git
cd scht
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Fill in the environment values before attempting sign-in. For a local product walkthrough only, enter `adminadminadmin` in the first sign-in email field; the demo route is disabled in production.

## Required configuration

At minimum, set these values in `.env.local` and in Vercel Production:

| Variable | Why it is needed |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser authentication and data access |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin, export, and reminder-dispatch operations |
| `NEXT_PUBLIC_APP_URL` | `https://scht-admu.vercel.app` in production |

Google sync also needs `INTEGRATION_ENCRYPTION_KEY`, `GOOGLE_OAUTH_CLIENT_ID`, and `GOOGLE_OAUTH_CLIENT_SECRET`. Apps Script reminders also need `REMINDER_DISPATCH_TOKEN`. Never commit `.env.local` or expose server-only values with a `NEXT_PUBLIC_` prefix.

Apply every SQL migration in `supabase/migrations`—including `0008_reminder_email_digest.sql`, `0009_projects_and_daily_digests.sql`, `0010_digest_cadence.sql`, and `0011_ai_connected_data_privacy.sql`—before inviting users. Full, copyable deployment instructions are in [SETUP.md](SETUP.md).

For a deliberately destructive fresh-deployment reset, use the reviewed, manual [master reset guide](supabase/MASTER_RESET.md). It is not a migration and must never be run without a verified Supabase backup and a manually replaced owner bootstrap email.

## Production checklist

1. Set the Vercel production domain to `https://scht-admu.vercel.app`.
2. Set Supabase Site URL to `https://scht-admu.vercel.app` and allow `https://scht-admu.vercel.app/auth/callback` as a redirect URL.
3. Configure the Google OAuth callback as `https://bethierxqssasenuzhal.supabase.co/auth/v1/callback` and enable Calendar/Gmail APIs.
4. Add all server and public environment values in Vercel, then redeploy.
5. Deploy the Apps Script companion if reminder email is enabled.
6. Verify the production flows listed in [SETUP.md](SETUP.md#13-verify-the-production-deployment).

## Main routes

| Route | Purpose |
| --- | --- |
| `/today` | Current-term agenda, focus task, and offline quick capture |
| `/onboarding` | Term setup, IPS import, and connected-service setup wizard |
| `/subjects` | Subjects, units, syllabi, assessment categories, and grade records |
| `/grades` | QPI/GPA progress and results |
| `/calendar` | Imported Google Calendar events and task deadlines |
| `/settings` | Integrations, AI vault, grading scale, and reminders |
| `/help` | In-app feature guide |
| `/admin` | Owner-only invitations, audit activity, and operations overview |

## Current scope and known limits

These are active product limits, not hidden placeholders:

- **Syllabus extraction:** text-based PDFs and text files receive automatic candidate-weight extraction. DOC/DOCX files are stored safely but still require manual grade-category entry.
- **Google sync:** the user starts sync manually; Calendar imports are capped at 100 upcoming events and Gmail at 25 unread messages per sync.

## Quality checks

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

## Project structure

- `app/` — Next.js routes and API handlers
- `components/` — workspace, settings, marketing, and admin UI
- `lib/` — Supabase, integrations, QPI/GPA, encryption, sync, and reminder logic
- `supabase/migrations/` — database schema and policies
- `apps-script/reminders.gs` — optional HTML email dispatcher
- `SETUP.md` — full local, Supabase, Google, Vercel, and Apps Script runbook
