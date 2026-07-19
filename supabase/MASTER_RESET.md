# Scht master reset (manual and destructive)

`master_reset.sql` is a fresh-deployment/reset artifact, not a migration. It is intentionally destructive and has not been executed by this repository.

It removes every Scht row in `public`, the one-time owner bootstrap entry, and every object in the `syllabi` Storage bucket. It preserves Supabase Auth users and all non-Scht Storage buckets. It does not delete the `syllabi` bucket itself; it makes that bucket private again and restores its owner-scoped policies.

Before doing anything, create and verify a Supabase database backup. Also export any syllabus files or workspace data you need. There is no recovery path in this script.

## Required preparation

1. Choose a **new Auth email address** for the first owner. Auth users are preserved by the reset, so an email that already has an Auth account will not fire the signup trigger and cannot consume the bootstrap entry.
2. Open `supabase/master_reset.sql` locally. Replace the literal `REPLACE_WITH_OWNER_EMAIL@example.com` with that exact lowercase email address. Do not leave the placeholder in place.
3. Review the complete file, especially the warning and `begin;`/`commit;` boundary. This script deletes data; it is not part of normal migration deployment.

## Supabase Dashboard SQL Editor

1. In the intended Supabase project, confirm the backup completed.
2. Open **SQL Editor** in the Supabase Dashboard and create a new query.
3. Paste the complete, edited contents of `supabase/master_reset.sql`.
4. Recheck the owner email literal, project selection, and destructive warning.
5. Run the query once. Do not run it through the app, a migration command, or an automated deploy step.
6. Complete sign-up and then sign in with the exact bootstrap owner email. The `auth.users` signup trigger creates the profile as `owner_admin` and atomically deletes the private bootstrap row. No arbitrary first account is promoted.
7. As that owner, verify `/admin`, create invitations, and have members sign in through their invited addresses.

If execution fails, the outer transaction rolls back rather than leaving a partial public schema. Do not retry until the error is understood and the backup remains available.

## Required environment values

Set environment values in `.env.local` for local work and in the hosting provider for production. Do not commit their values:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `INTEGRATION_ENCRYPTION_KEY` (server-only, base64-encoded 32-byte key)
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `REMINDER_DISPATCH_TOKEN` (server-only where applicable)

Provider credentials are encrypted before storage; the compact schema has no plaintext provider-token columns and retains no provider payload archive.
