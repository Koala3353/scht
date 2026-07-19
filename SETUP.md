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

Add these server-only values before connecting integrations:

```env
INTEGRATION_ENCRYPTION_KEY=<base64-encoded-32-byte-key>
GOOGLE_OAUTH_CLIENT_ID=<google-web-client-id>
GOOGLE_OAUTH_CLIENT_SECRET=<google-web-client-secret>
REMINDER_DISPATCH_TOKEN=<long-random-secret>
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

## 9. Follow-on feature configuration

The live integrations, reminders, encrypted AI vault, syllabus approval, grade-entry, and owner operations added after the initial foundation require the configuration below. This section supersedes earlier wording that described reminder dispatch as unavailable.

### Environment variables

The app accepts either public Supabase key name. With the key provided by the Supabase dashboard, use one—not both—of these forms:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
# or: NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
NEXT_PUBLIC_APP_URL=http://localhost:3001

# Server-only: never prefix these with NEXT_PUBLIC_
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
INTEGRATION_ENCRYPTION_KEY=<base64 32-byte key>
GOOGLE_OAUTH_CLIENT_ID=<Google web OAuth client ID>
GOOGLE_OAUTH_CLIENT_SECRET=<Google web OAuth client secret>
REMINDER_DISPATCH_TOKEN=<long random token>
HACK_CLUB_AI_BASE_URL=https://ai.hackclub.com/v1
```

Generate the two random values locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use the first as `INTEGRATION_ENCRYPTION_KEY` and the second as `REMINDER_DISPATCH_TOKEN`.

### Google Calendar and Gmail

The Google web OAuth client configured in Supabase must be the same client whose ID and secret are supplied to Scht. In Google Cloud, add Calendar and Gmail read-only scopes to the consent screen. In Scht Settings, choose **Connect Google**, complete consent, then choose **Sync Google**. Imported events appear on Calendar and unread Gmail message subjects become deduplicated planner tasks.

### Canvas

Create a personal access token in your institution’s Canvas account. In Settings, enter the Canvas base URL (for example, `https://canvas.example.edu`) and that token, then choose **Connect Canvas** and **Sync assignments**. Scht validates the connection, encrypts the token using AES-256-GCM before persistence, then imports active courses and assignments into the selected academic term.

### Syllabi, grades, and AI

Upload a syllabus from a subject card. Text-based files have candidate grade weights extracted; review or add categories until the total is exactly 100%, then approve them. Record assessment scores from Grades only after a category has been approved.

In Settings, save an OpenAI or Hack Club AI key through **Encrypted AI key vault** with a passphrase of at least 12 characters. It is encrypted in the browser using PBKDF2 plus AES-GCM before being stored. The AI workbench requires an unlocked key for each proposal and does not write tasks until the user explicitly applies the reviewed result.

### Ateneo QPI and GPA

Migration `0007_academic_scale_and_subject_units.sql` adds the academic-scale preference and course-unit field. After applying it, set each subject’s units from the Subjects page. Scht defaults to **Ateneo QPI** and uses the units-weighted formula: the quality-point equivalent of every graded subject multiplied by its course units, divided by the total counted units. In Settings, select **4.0 GPA** to use the same unit weighting with a percentage-to-4.0 estimate instead.

The QPI percentage cutoffs are an estimate based on an [Ateneo QPI calculator](https://qpi.alexi.life/) and an [Ateneo course grading table](https://aisis.ateneo.edu/syllabi/2022/1/CS-MA-MATH199.11-TOLENTINO_M_DAVID_R_BENITO_D-T1-2022-1.pdf); always defer to your instructor’s or school’s current grading policy. Only subjects with at least one recorded assessment are counted.

### Reminder delivery

After deploying to Vercel, set Apps Script properties as follows:

```text
SCHT_REMINDER_ENDPOINT=https://<your-vercel-domain>/api/reminders/dispatch
SCHT_REMINDER_TOKEN=<same REMINDER_DISPATCH_TOKEN>
```

Create a time-driven trigger for `dispatchSchtReminders` every 15 minutes and grant `UrlFetchApp` and `MailApp` permissions. Users save a time zone and quiet hours in Settings, then schedule a reminder from an open, due-dated task. The protected dispatch route returns pending jobs, Apps Script sends mail, and acknowledges successful or failed delivery.

### Vercel

Set every variable above in Vercel for the environments that use the corresponding feature. Add the Vercel production URL and `/auth/callback` redirect URL to Supabase Authentication URL Configuration. The Apps Script endpoint must point to the deployed production domain, never `localhost`.

## 10. `.env.local` reference

Copy `.env.example` to `.env.local`, then configure every entry as follows. Keep `.env.local` out of Git.

| Variable                               | What to enter                                                                                                                                                                         | Required for                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Your Supabase project URL, such as `https://<project-ref>.supabase.co`.                                                                                                               | Always.                                                 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`        | The public `sb_publishable_...` key from Supabase API Keys. Use this **or** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.                                                                   | Always.                                                 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The same public key, using Supabase’s current variable name. Leave `NEXT_PUBLIC_SUPABASE_ANON_KEY` empty when using this form.                                                        | Always, as an alternative to the anonymous-key name.    |
| `SUPABASE_SERVICE_ROLE_KEY`            | The server-side `service_role` key from Supabase API Keys. Never expose it to the browser or commit it.                                                                               | Owner exports, reminder dispatch, and local demo login. |
| `NEXT_PUBLIC_APP_URL`                  | `http://localhost:3001` locally; the exact Vercel URL in each deployed environment.                                                                                                   | Auth redirects and provider callbacks.                  |
| `INTEGRATION_ENCRYPTION_KEY`           | A base64-encoded 32-byte random key. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.                                                     | Canvas and Google token encryption.                     |
| `GOOGLE_OAUTH_CLIENT_ID`               | The Web OAuth client ID from Google Cloud—the same client configured in Supabase’s Google provider.                                                                                   | Refreshing Google Calendar/Gmail connections.           |
| `GOOGLE_OAUTH_CLIENT_SECRET`           | The matching Web OAuth client secret from Google Cloud.                                                                                                                               | Refreshing Google Calendar/Gmail connections.           |
| `REMINDER_DISPATCH_TOKEN`              | A long random shared secret, for example `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Configure the same value as Apps Script’s `SCHT_REMINDER_TOKEN`. | Protected Apps Script reminder delivery.                |
| `HACK_CLUB_AI_BASE_URL`                | Leave as `https://ai.hackclub.com/v1` unless Hack Club provides a replacement endpoint.                                                                                               | Hack Club AI provider.                                  |

### Local demo sign-in

On the first screen, type exactly `adminadminadmin` in the email field and submit. In local development, Scht opens an interactive preview workspace immediately—no credentials required. If `SUPABASE_SERVICE_ROLE_KEY` is present, it instead creates or reuses `adminadminadmin@demo.scht.local`, seeds a small member workspace, and follows Supabase’s normal one-time login flow. The demo endpoint and preview page return 404 in production builds.
