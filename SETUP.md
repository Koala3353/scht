# Scht setup and deployment

## 1. Prerequisites

- Node.js 20 or newer
- A Supabase project
- A Google Cloud project (optional, for Google sign-in)
- A Vercel account (for hosting)
- An Apps Script project (optional, for reminder dispatch)

## 2. Local application

```bash
cd 'School Tool "Scht"/.worktrees/scht-foundation'
npm ci
cp .env.example .env.local
```

Set `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
# The Supabase `sb_publishable_...` key belongs here.
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

Do not add a Supabase secret/service key to `NEXT_PUBLIC_*` variables. The current app does not require one for normal user authentication or data access.

Run on a dedicated port so it does not conflict with another Next.js project:

```bash
npm run dev -- --port 3001
```

Open `http://localhost:3001`.

## 3. Supabase database and first invite

In the Supabase SQL Editor, run all files in `supabase/migrations` in ascending numeric order. The migrations create the tables, row-level security policies, task sync structures, academic records, and reminder structures.

The app is invite-only. After applying migrations, create the first invite in the SQL Editor (replace the email):

```sql
insert into public.invites (email, role)
values ('you@example.com', 'owner_admin');
```

Use `member` for ordinary users. The first successful sign-in accepts the matching invite and creates the profile.

## 4. Google sign-in

1. In Google Cloud Console, configure the OAuth consent screen and add your account as a test user while the app remains in testing.
2. Create an OAuth client of type **Web application**.
3. Add this exact Google authorized redirect URI:

   ```text
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

4. In Supabase Dashboard → Authentication → Providers → Google, enable Google and paste the Google client ID and client secret.
5. In Supabase Dashboard → Authentication → URL Configuration, set:

   ```text
   Site URL: http://localhost:3001
   Redirect URL: http://localhost:3001/auth/callback
   ```

For production, replace the local URLs with `https://<your-vercel-domain>/` and `https://<your-vercel-domain>/auth/callback`.

## 5. Apps Script reminder companion

`apps-script/reminders.gs` is the owner-managed companion entry point. To install it:

1. Create a new Google Apps Script project at `script.google.com`.
2. Copy the contents of `apps-script/reminders.gs` into `Code.gs`.
3. In Project Settings → Script properties, add:

   ```text
   SCHT_REMINDER_ENDPOINT=https://<your-domain>/api/reminders/dispatch
   SCHT_REMINDER_TOKEN=<long-random-secret>
   ```

4. Add the same token as a server-only environment variable in the reminder-dispatch service.
5. Create a time-driven trigger for `dispatchSchtReminders` at your chosen cadence.
6. Run it once manually and grant the requested `UrlFetchApp` permission.

The companion safely fails if its endpoint or token is missing. It is intentionally not enabled by default: this repository includes the scheduling helper and reminder queue schema, but you must deploy a protected reminder-dispatch endpoint and choose an email provider before it can send email. Never put its dispatch token in a browser-accessible environment variable.

## 6. GitHub

Push the branch, then open a pull request or merge to `main`:

```bash
git push -u origin feature/scht-foundation
```

Connect the GitHub repository to Vercel. Vercel will create Preview deployments for branches and a Production deployment when `main` is updated.

## 7. Vercel

1. In Vercel, import the GitHub repository and set the root directory to this Next.js project.
2. Add these environment variables for **Production**, **Preview**, and **Development** as appropriate:

   ```text
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   NEXT_PUBLIC_APP_URL
   ```

3. Set `NEXT_PUBLIC_APP_URL` to the exact deployed URL for each environment. Preview deployments should use a preview-specific URL or only support email links after adding a wildcard redirect URL in Supabase.
4. Deploy. After the first deployment, add its callback URL to Supabase URL Configuration and update the production Site URL.

## 8. Checks

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

The browser test placeholders are skipped until a disposable Supabase project and authentication fixtures are configured.
