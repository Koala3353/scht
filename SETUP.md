# Deploying Scht

This guide takes a new Scht installation from local development to a working Vercel deployment with Supabase authentication, Google Calendar/Gmail sync, Canvas import, AI, QPI/GPA tracking, Apps Script reminders, and owner administration.

The intended production URL is [scht-admu.vercel.app](https://scht-admu.vercel.app). Assign it to a ready Vercel production deployment before using it in Supabase or Apps Script settings.

## 1. What you need

- Node.js 20 or newer and npm
- A Supabase project
- A Google Cloud project (`scht-502902` for the current deployment)
- A Vercel account connected to [Koala3353/scht](https://github.com/Koala3353/scht)
- A Google account for Apps Script if email reminders are needed
- Optional: a Canvas personal access token and a personal OpenAI or Hack Club AI key for each user who wants those features

## 2. Install and run locally

```bash
cd 'School Tool "Scht"/.worktrees/scht-foundation'
npm ci
cp .env.example .env.local
npm run dev -- --port 3001
```

Open [http://localhost:3001](http://localhost:3001). Use port `3001` if port `3000` is occupied by another project.

For a development-only walkthrough, enter exactly `adminadminadmin` in the first email field. The demo route is disabled from production builds. With a configured service-role key it creates a seeded Supabase demo workspace; without one it opens the local preview page.

## 3. Environment variables

Copy `.env.example` to `.env.local`. Never commit `.env.local`, and never put a server secret in a `NEXT_PUBLIC_` variable.

| Variable                               | Value to set                                                                                                                        | Required for                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase Dashboard → Project Settings → API → Project URL, e.g. `https://<project-ref>.supabase.co`.                                | Every environment.                                                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase’s public `sb_publishable_...` key.                                                                                         | Every environment.                                                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`        | Legacy alternative to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; set **one**, not both.                                                | Every environment if using the legacy key name.                     |
| `SUPABASE_SERVICE_ROLE_KEY`            | Supabase Dashboard → Project Settings → API → `service_role` secret. It must remain server-only.                                    | Owner data export, Apps Script dispatch, and the seeded local demo. |
| `NEXT_PUBLIC_APP_URL`                  | `http://localhost:3001` locally. In Vercel, the exact deployment URL, currently `https://scht-admu.vercel.app`. | Auth and provider return URLs.                                      |
| `INTEGRATION_ENCRYPTION_KEY`           | A base64-encoded 32-byte random key. Generate it with the command below. Keep the same value after deployment.                      | Encrypting Canvas and Google connection tokens.                     |
| `GOOGLE_OAUTH_CLIENT_ID`               | The Google **Web application** OAuth client ID configured in Supabase.                                                              | Google Calendar and Gmail sync.                                     |
| `GOOGLE_OAUTH_CLIENT_SECRET`           | The matching Google OAuth client secret.                                                                                            | Google Calendar and Gmail sync.                                     |
| `GOOGLE_CLOUD_PROJECT_ID`              | `scht-502902` for this project, or your replacement Google Cloud project ID.                                                        | The owner-admin link to Google test users.                          |
| `REMINDER_DISPATCH_TOKEN`              | A long random shared secret generated below. Use the identical value in Apps Script script properties.                              | Protected reminder delivery.                                        |
| `HACK_CLUB_AI_BASE_URL`                | Leave `https://ai.hackclub.com/v1` unless Hack Club gives you another compatible endpoint.                                          | Hack Club AI provider.                                              |

Generate the random server values once:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use the first output for `INTEGRATION_ENCRYPTION_KEY`; use the second for `REMINDER_DISPATCH_TOKEN`. Rotate either value only with care: changing the encryption key makes previously stored integration credentials unreadable.

### Vercel environment setup

In Vercel → **Scht** → Settings → Environment Variables, add the variables above to the environments where they are needed:

- **Production:** all enabled features, and `NEXT_PUBLIC_APP_URL` set to the production URL.
- **Preview:** public Supabase values and a preview-safe `NEXT_PUBLIC_APP_URL`; add server values only if you intentionally test those integrations in previews.
- **Development:** local values if you use `vercel env pull`; otherwise `.env.local` is enough.

After changing any variable, redeploy. Vercel only exposes `NEXT_PUBLIC_*` values at build time.

## 4. Create the Supabase database

In Supabase Dashboard → SQL Editor, run each migration in this exact order:

```text
supabase/migrations/0001_foundation.sql
supabase/migrations/0002_validate_scoped_reference_owners.sql
supabase/migrations/0003_add_curriculum_import_fields.sql
supabase/migrations/0004_add_sync_errors.sql
supabase/migrations/0005_academics_automation.sql
supabase/migrations/0006_provider_sync_and_syllabus_storage.sql
supabase/migrations/0007_academic_scale_and_subject_units.sql
supabase/migrations/0008_reminder_email_digest.sql
supabase/migrations/0009_projects_and_daily_digests.sql
supabase/migrations/0010_digest_cadence.sql
supabase/migrations/0011_ai_connected_data_privacy.sql
```

They create the invite-only workspace, row-level security policies, subjects and QPI/GPA records, task sync, encrypted integration storage, syllabi, reminders, and audit log. Apply migrations before deploying; the app will not work correctly with only a subset.

Create the first owner invite after the migrations, replacing the email address:

```sql
insert into public.invites (email, role)
values ('you@example.com', 'owner_admin');
```

The user’s first successful sign-in accepts the invite and creates their profile. Ordinary people should have the `member` role.

## 5. Configure Supabase authentication

In Supabase Dashboard → Authentication → URL Configuration:

- **Site URL**: `http://localhost:3001` for local development. In Production, set it to `https://scht-admu.vercel.app`.
- Add **Redirect URLs**:

  ```text
  http://localhost:3001/auth/callback
  https://scht-admu.vercel.app/auth/callback
  ```

  Add your own Vercel production URL instead if it differs. Add a preview URL only when you deliberately support auth in previews.

Supabase is the application’s authentication authority. Keep email confirmation and redirect settings appropriate to your institution’s policy.

## 6. Configure Google sign-in, Calendar, and Gmail

Scht uses one Google **Web application** OAuth client via Supabase. Its Calendar and Gmail integrations ask only for `calendar.readonly` and `gmail.readonly` access, and tokens are stored encrypted with `INTEGRATION_ENCRYPTION_KEY`.

1. In [Google Auth Platform](https://console.cloud.google.com/auth), select project `scht-502902` (or the value of `GOOGLE_CLOUD_PROJECT_ID`).
2. In Google Cloud → APIs & Services → Library, enable **Google Calendar API** and **Gmail API** for this project.
3. Complete branding and audience setup. Set the application home page to `https://scht-admu.vercel.app`, the privacy policy URL to `https://scht-admu.vercel.app/privacy`, and the terms of service URL to `https://scht-admu.vercel.app/terms`. For an External app in **Testing**, add every person who needs Google sign-in or Calendar/Gmail sync at [Google Auth Platform → Audience → Test users](https://console.cloud.google.com/auth/audience?project=scht-502902).
4. Add the Calendar and Gmail read-only scopes to the consent configuration:

   ```text
   https://www.googleapis.com/auth/calendar.readonly
   https://www.googleapis.com/auth/gmail.readonly
   ```

5. Create one Web application OAuth client at [Create OAuth client](https://console.cloud.google.com/auth/clients/create?project=scht-502902). The client’s **Authorized redirect URI** must be exactly:

   ```text
   https://bethierxqssasenuzhal.supabase.co/auth/v1/callback
   ```

   Replace `<project-ref>` with your Supabase project reference. Do not put the Scht app URL in this Google field; Supabase receives Google’s callback first.

6. Copy the client ID and client secret to `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` in Vercel (and `.env.local` when testing locally).
7. In Supabase Dashboard → Authentication → Providers → Google, enable Google and paste the same client ID and client secret.
8. Sign in to Scht, open Settings, choose **Connect Google**, approve the requested read-only access, then choose **Sync Google**.

Google’s testing audience can contain up to the limit Google applies to test users. A test user must be added in Google Cloud manually; Scht never receives authority to change your Google Cloud project. The owner-admin **Add account** flow saves the Scht invite, then shows the exact email and opens the correct Test users page so the owner can add it.

## 7. Configure Canvas

Canvas is connected per user and does not require an owner server key.

1. In the user’s Canvas account, create a personal access token.
2. In Scht Settings, enter the Canvas base URL (for example, `https://canvas.example.edu`) and the token.
3. Select **Connect Canvas**, then **Sync assignments**.

Scht validates the connection, encrypts the token before saving it, imports active courses and assignments, and associates the data with the selected academic term. A school may restrict personal access tokens; follow its Canvas policy.

## 8. Configure AI features

Users provide their own key in Settings → **Encrypted AI key vault**. The key is encrypted in the browser with the user’s passphrase before it is stored. Scht uses it only while the user explicitly unlocks the vault and requests a proposal.

- For OpenAI, choose the OpenAI provider and enter a user-created API key.
- For Hack Club, choose Hack Club and enter the user’s Hack Club AI key. Keep `HACK_CLUB_AI_BASE_URL=https://ai.hackclub.com/v1` unless a replacement endpoint is supplied.

AI proposes tasks from planning text. It cannot write planner data until the user reviews and explicitly applies the proposal. Never put individual users’ AI keys in Vercel environment variables.

## 9. Configure AI data privacy

AI only receives the text a student explicitly submits by default. In **Settings → AI vault**, leave **Allow connected data in a future AI request** off unless the student expressly wants to use imported Calendar or Gmail context. Turning it on does not send anything automatically; a future connected-data AI action must still be separately initiated and reviewed.

## 10. Enable QPI/GPA, subjects, and syllabi

After migration `0007`, Scht defaults to **Ateneo QPI**. Add each subject’s units on the Subjects page, enter approved assessment categories and scores, and Scht calculates a units-weighted QPI. In Settings, select **4.0 GPA** to use the alternative GPA scale.

For a syllabus, upload it from the subject card. Text files receive candidate grade-weight extraction; PDF and DOC/DOCX files are stored but currently need manual category entry. Review every category, ensure weights total exactly 100%, and approve them before entering scores. Always defer to the school’s official and current grading policy; the built-in QPI mapping is an estimate.

## 11. Deploy Apps Script reminders

Scht’s reminder worker is [apps-script/reminders.gs](apps-script/reminders.gs). It calls the protected Vercel route, sends a responsive HTML email from the script owner’s Google account, and acknowledges each job. Scheduled task reminders and optional email updates use the student’s chosen 1, 3, 7, or 14-day outlook. Students can choose a concise daily update or a genuine once-weekly update on a selected weekday; the timeline combines only data already imported into Scht: Google Calendar events, Canvas deadlines, Gmail follow-ups, and due-dated Scht tasks.

1. Create a Google Apps Script project at [script.google.com](https://script.google.com).
2. Replace `Code.gs` with the contents of `apps-script/reminders.gs`.
3. In Project Settings → Script properties, set:

   ```text
   SCHT_REMINDER_ENDPOINT=https://scht-admu.vercel.app/api/reminders/dispatch
   SCHT_REMINDER_TOKEN=<the exact REMINDER_DISPATCH_TOKEN from Vercel>
   ```

   Use your actual production domain if it differs.

4. Create a time-driven trigger for `dispatchSchtReminders` every 15 minutes. Select the account and timezone intentionally: `MailApp` sends from that account, and its quota applies to that account.
5. Run `dispatchSchtReminders` once manually and approve the `UrlFetchApp` and `MailApp` permissions.
6. In Scht **Settings → Reminders**, choose the outlook window, turn on the scheduled email update if wanted, then choose **Daily** or **Weekly**, a delivery time, and (for weekly) its weekday. Connect/sync Google or Canvas first if you want those items in the email. The email includes a quick count of tasks and events, ordered upcoming dates, Gmail follow-ups, and a link back to Scht.
7. Create a due-dated task, schedule a reminder, and verify the HTML email has the reminder, timeline, and Gmail review list (when unread Gmail items were imported).

The Apps Script project never receives Google OAuth, Canvas, or Supabase credentials; it only needs the protected endpoint and `REMINDER_DISPATCH_TOKEN`. The dispatch route needs both `SUPABASE_SERVICE_ROLE_KEY` and `REMINDER_DISPATCH_TOKEN`; the latter is checked on every request. Do not expose either token in client-side code or a public Apps Script URL.

## 12. Add accounts from the owner dashboard

After the first owner signs in, open **Owner Admin** → **Add an account**.

1. Enter the school email, choose `Student member` or `Owner admin`, and optionally set an expiry.
2. Select **Add account**. This writes an `invites` record in Supabase and logs the action; it does not create a Google account or a Supabase user prematurely.
3. If Google OAuth is still in Testing, use **Copy email** and **Open Google test users** in the success card. Add that exact email to the test-user list.
4. The student signs in with that email. On their first accepted sign-in, their Scht profile is created.

The link in the success card is intentionally:

```text
https://console.cloud.google.com/auth/audience?project=scht-502902
```

The often-shared `/auth/clients/create` link is for creating the OAuth client once; it does not add a person to the OAuth test audience.

## 13. Deploy with GitHub and Vercel

The repository is already connected to GitHub at [Koala3353/scht](https://github.com/Koala3353/scht) and its Vercel project is `scht-admu`.

For normal releases:

```bash
git status
git add <the files you changed>
git commit -m "Describe the change"
git push origin feature/scht-foundation
```

In Vercel:

1. Confirm the **Root Directory** is the directory containing `package.json` (the active Scht worktree/project).
2. Set the Production Branch to the branch you intend to release, or merge that branch into your chosen production branch.
3. Add all required production environment variables from section 3.
4. Deploy and copy the final production domain into `NEXT_PUBLIC_APP_URL` and Supabase URL Configuration.
5. Redeploy once more after changing those URLs.

If you deploy through the CLI instead, link the already-created Vercel project and deploy:

```bash
vercel link --project scht
vercel --prod
```

Avoid changing an old Vercel alias by editing code. A `404: NOT_FOUND` from `scht-kappa.vercel.app` means that host is not owned by this project; use the active project domain in Vercel → Settings → Domains, then update Supabase and `NEXT_PUBLIC_APP_URL` to match it.

## 14. Verify the production deployment

Run these checks before and after deployment:

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

Then verify in the deployed app:

1. Open the production URL and complete a normal Google sign-in with an invited email.
2. Create a subject, set its units, and switch between QPI and GPA in Settings.
3. Connect and sync Google or Canvas with a dedicated test account.
4. Save and unlock an AI key, request a proposal, and confirm it only changes the planner after applying it.
5. Add a reminder and confirm the Apps Script sends exactly one email.
6. As an owner, add a test account and confirm the Google Test users link contains the expected project ID.

## 15. Troubleshooting

| Symptom                                                       | Fix                                                                                                                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google says the app is blocked or the user is not authorized. | Add the email on Google Auth Platform → Audience → Test users, then try again.                                                                                                        |
| `redirect_uri_mismatch` from Google.                          | The Google Web client must contain exactly `https://bethierxqssasenuzhal.supabase.co/auth/v1/callback`.                                                                                      |
| Supabase sends users to the wrong domain.                     | Update Supabase Site URL and Redirect URLs, set `NEXT_PUBLIC_APP_URL` to the same environment’s domain, then redeploy.                                                                |
| Calendar/Gmail connection fails after a deployment.           | Confirm the same Google client is enabled in Supabase and configured as `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`; confirm `INTEGRATION_ENCRYPTION_KEY` did not change. |
| Apps Script returns 401 or sends nothing.                     | Match `SCHT_REMINDER_TOKEN` exactly to Vercel’s `REMINDER_DISPATCH_TOKEN`, and ensure the endpoint uses the active production domain.                                                 |
| Owner export or seeded local demo errors about a service key. | Add the server-only `SUPABASE_SERVICE_ROLE_KEY`; never expose it in `NEXT_PUBLIC_*`.                                                                                                  |
| A Vercel short URL returns `404: NOT_FOUND`.                  | Use the active `scht-admu` project domain shown in Vercel, not the retired `scht-kappa.vercel.app` alias.                                                                                  |

## 16. Security checklist

- Keep `.env.local`, Vercel secret values, Google client secrets, service-role keys, reminder tokens, Canvas tokens, and personal AI keys out of Git.
- Use separate Google/Supabase/Vercel projects for testing and production when possible.
- Rotate a compromised secret immediately; reconnect integrations if the encryption key changes.
- Review Google scopes, Canvas policy, and your school’s data policy before inviting students.
- Keep Google OAuth in Testing only while necessary; follow Google’s verification process before broad external use.
