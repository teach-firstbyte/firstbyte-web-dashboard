# FirstByte Infrastructure Dashboard

A dashboard for tracking FirstByte club participation, attendance, projects, and engagement.

---

## 🚀 Tech Stack

- **Frontend:** Next.js 15, React, TypeScript, Tailwind CSS
- **Backend:** Prisma ORM, Supabase PostgreSQL
- **UI Components:** shadcn/ui
- **Deployment:** Vercel

---

## 📋 Prerequisites

- Node.js 18.x or 20.x
- npm (or your preferred package manager)
- Access to the shared Supabase database (ask a project admin for credentials)

---

## 🔐 Environment Setup

1. **Clone the repository**

   ```bash
   git clone [REPO_URL]
   cd [REPO_NAME]
   ```

2. **Copy and update environment variables**
   - Create an `.env.local` file
   - Ask Hector or Nick for the Supabase keys
   - Fill in the required values (Will have **two** files)
     ```.env
     DATABASE_URL="postgresql://postgres.[URL]:[PASSWORD]@aws-0-us-east-2.pooler.supabase.com:6543/postgres"
     ```
     ```.env.local
     NEXT_PUBLIC_SUPABASE_URL="https://[URL].supabase.co"
     NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="[PUBLISHABLE_KEY]"
     ```

- Generate a `CHECKIN_SECRET` for the attendance check-in codes:
  ```bash
  openssl rand -hex 32
  ```
  Add it to `.env.local`. **This is a server-only secret — do NOT prefix it with `NEXT_PUBLIC_`.** It signs the check-in codes; if it leaks to the browser, anyone could forge attendance codes.
  ```.env.local
   CHECKIN_SECRET="[GENERATED_SECRET]"
  ```

3. **Install dependencies**
   ```bash
   npm install
   ```

---

## 🗄️ Database & Prisma Setup

**Never run `prisma db push` or `prisma migrate dev` against the production database.** Both can wipe its data. To change it, see [Applying migrations to production](#-applying-migrations-to-production).

1. **Generate the Prisma Client**

   ```bash
   npx prisma generate
   ```

   This creates the client code used by the app to interact with the database.

2. **Adding a new table? Turn on row-level security (RLS) in the same migration.**
   Supabase also serves every table in `public` through its own REST API (the "Data API"), which anyone with the publishable key can call. The app never uses that API: it reads and writes only through Prisma, which skips RLS. So every table has RLS on with **no policies**, which blocks the Data API completely. Prisma doesn't do this for you, so after `npx prisma migrate dev --create-only`, add this line to the new `migration.sql`:
   ```sql
   ALTER TABLE "your_table" ENABLE ROW LEVEL SECURITY;
   ```
   Supabase's Security Advisor (dashboard -> Advisors) warns about any table that was missed.

---

## 🚀 Applying migrations to production

A **migration** is a SQL file in `prisma/migrations/` that changes the database's structure (a new table, a new column...). Prisma has two commands for them, and they do very different things:

| Command                     | Use it on                | What it does                                                                                                                                                   |
| --------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx prisma migrate dev`    | Your local database only | Creates new migration files from `schema.prisma` and applies them. If the database doesn't match what it expects, it offers to **reset it (delete all data)**. |
| `npx prisma migrate deploy` | Production               | Applies committed migrations that haven't run yet. Never creates migrations, never resets.                                                                     |

### Where each database's settings live

| Database                   | App settings                              | Migration settings                         |
| -------------------------- | ----------------------------------------- | ------------------------------------------ |
| Local (Supabase in Docker) | `.env` and `.env.local`                   | `.env`                                     |
| Production                 | Vercel → Settings → Environment Variables | GitHub environment **Production database** |
| Preview (shared)           | Vercel → Settings → Environment Variables | GitHub environment **Preview database**    |

Keep `.env` and `.env.local` pointed at your local database. Don't switch them to production by commenting lines in and out: if you forget to switch back, the next `migrate dev` runs against the real data.

### The normal way: GitHub Actions

The **Database migrations** workflow (`.github/workflows/migrate.yml`) runs `prisma migrate deploy` for you when a push to `main` changes `prisma/migrations/`. It waits for a required reviewer to click **Approve** (GitHub → Actions → the run → Review deployments) before it touches the database. To re-run it by hand: GitHub → Actions → Database migrations → Run workflow.

How it's set up (GitHub → Settings → Environments → **Production database**):

- Secrets, copied from the Supabase project's **Connect** page:
  - `DATABASE_URL`: the **Transaction pooler** string (port 6543)
  - `DIRECT_URL`: the **Session pooler** string (port 5432)
- Required reviewers, and only the `main` branch may use it.

Both strings must use the shared pooler, whose host looks like `aws-0-us-east-2.pooler.supabase.com`. GitHub's machines have no IPv6, so anything on `db.<project>.supabase.co` (the direct connection, or the paid plans' dedicated pooler) won't connect from there.

### By hand, when you need to

1. Copy `.env.production.example` to `.env.production` and fill in the two connection strings. It is git-ignored.
2. See what would run, then apply it:
   ```bash
   npm run db:status:production
   npm run db:migrate:production
   ```
   Check that the `Datasource "db"` line Prisma prints names the database you meant.

### Writing a migration that's safe to deploy

The migration and the new code never go live at exactly the same moment, so each migration must work with **both** the code that's running now and the code that's coming. For example, to rename a column: add the new column in one PR, switch the code to it in the next, and drop the old column in a later one.

## 💤 Keeping the database awake

The production database is on Supabase's Free plan, which **pauses a project after about 7 days of low activity**. While it is paused, the dashboard can't load any data. To prevent that, the **Keep database awake** workflow (`.github/workflows/keep-database-awake.yml`) runs one small query every day.

If the database pauses anyway, open the project in the Supabase dashboard and click **Resume project**. You have 90 days to do this before the one-click restore stops working.

The workflow logs in as `keepalive`, a Postgres role that can connect but **has no access to any table**, so its password can't read or change club data. To set it up again (for example, for a new Supabase project):

Run steps 1, 2 and 4 in **one terminal window**: the password lives in a shell variable, which only that window can see. It never appears on screen or in your shell history.

1. Make a password and keep it in a variable. Hex characters are safe in a URL, so the password needs no escaping:
   ```bash
   KEEPALIVE_PW=$(openssl rand -hex 24)
   ```
2. Copy it to the clipboard. `printf` adds no line break at the end, which would otherwise become part of the password:
   ```bash
   printf '%s' "$KEEPALIVE_PW" | pbcopy
   ```
3. In Supabase → SQL Editor, run this with the password pasted in. If the role already exists and you only want a new password, run `alter role keepalive with password 'PASTE_PASSWORD_HERE';` instead:
   ```sql
   create role keepalive with login password 'PASTE_PASSWORD_HERE' connection limit 2;
   alter role keepalive set statement_timeout = '5s';
   ```
4. Back in the same terminal window, save the **Session pooler** connection string as a **repository** secret, then forget the password. Replace `<project-ref>` with the id in the project's URL. This step reads the variable, not the clipboard, so it is fine to copy this command from here:
   ```bash
   gh secret set KEEPALIVE_DATABASE_URL --repo teach-firstbyte/firstbyte-web-dashboard --body "postgresql://keepalive.<project-ref>:${KEEPALIVE_PW}@aws-0-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require" && unset KEEPALIVE_PW
   ```
5. Test it: GitHub → Actions → Keep database awake → Run workflow. The log should print the database's current time.

GitHub turns off scheduled workflows in a public repository after 60 days without a commit, and emails first. After a long break, turn it back on from the workflow's page in the Actions tab.

The workflow pings the **preview** project, too, with its own `keepalive` role and its own secret, `KEEPALIVE_PREVIEW_DATABASE_URL`. Set it up with the same 5 steps, but with these 3 changes:

- In step 3, open the SQL Editor of the **preview** project (`kszxdakaiyispmrgicim`), not production.
- In step 4, save it under the other name, with the preview project's ref:
  ```bash
  gh secret set KEEPALIVE_PREVIEW_DATABASE_URL --repo teach-firstbyte/firstbyte-web-dashboard --body "postgresql://keepalive.kszxdakaiyispmrgicim:${KEEPALIVE_PW}@aws-0-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require" && unset KEEPALIVE_PW
  ```
- In step 5, check that **both** jobs pass: `ping (production)` and `ping (preview)`.

Make a new password for preview. Do not use the production one again.

---

## 🧪 Preview environment

A **preview deployment** is a temporary copy of the site that Vercel builds for every pull request. It lets you try a change before it reaches teachfirstbyte.com.

### How it works

- **Where to open it.** Open the **website** preview, not the dashboard one, and add `/dashboard`. Find the website preview link in the pull request's Vercel comment. It looks like `https://firstbyte-website-git-<branch>-firstbyte-neu.vercel.app/dashboard`. The website sends `/dashboard` to the dashboard preview of the same branch (`VERCEL_RELATED_PROJECTS`, set up by `apps/web/vercel.json` and read in `apps/web/next.config.mjs`). The build log of the website preview prints a `Dashboard zone:` line about it.
  - If your branch never changes `apps/dashboard`, Vercel skips the dashboard preview, and `/dashboard` on the website preview shows a 404. To fix it, redeploy the dashboard project from your branch: Vercel → firstbyte-dashboard → Deployments → **Create Deployment** → your branch.
- **Login wall.** Vercel asks you to log in to Vercel first. Only people on the Vercel team can open previews. The dashboard preview has its own login wall, so after you log in, the browser usually lands on the dashboard preview's own address (`https://firstbyte-dashboard-git-<branch>-firstbyte-neu.vercel.app/dashboard`). That is the same deployment, and everything works there. Only "Back to main site" does not lead back to the website preview.
- **One shared database.** Every preview uses the same Supabase project, `kszxdakaiyispmrgicim` (production is `bohtlovxpytpylfaievn`). What you change on one preview shows on all of them. It never holds real member data. The officers' names and emails are copied from production, and every other member is made up.
- **Login.** Preview uses that project's own Supabase Auth, so production passwords do not work there. Use a [test login](#test-logins).
- **Google sign-in is off on preview.** The login page hides the Google button and shows a note instead. The check is `isPreviewDeployment()` in `src/lib/deployment.ts`.
- **Own secrets.** Preview has its own `CHECKIN_SECRET`, `CRON_SECRET` and `SUPABASE_SECRET_KEY` in Vercel. It has no `NEXT_PUBLIC_APP_URL`, so a password reset asks Supabase to send people back to the host you browse (the `x-forwarded-host` fallback in `src/app/forgot-password/actions.ts`). See [Emails on preview](#emails-on-preview-do-not-work-with-the-apps-links) for why those emails still do not work.
- **Forms.** `next.config.ts` lets preview builds accept form submits (server actions) from `*.vercel.app`. Production builds accept only teachfirstbyte.com.

### Test logins

| Email                         | What it is                                              |
| ----------------------------- | ------------------------------------------------------- |
| `test-admin@firstbyte.test`   | Super admin, on E-Board                                 |
| `test-officer@firstbyte.test` | Officer, lead of CS Curricula, on E-Board               |
| `test-member@firstbyte.test`  | Approved member of CS Curricula and Website             |
| `test-pending@firstbyte.test` | Account waiting for officer review, asking to join STEM |

The seed also makes a fake e-board of 8 (`maya.okafor@firstbyte.test` and the rest) for testing the task board's Slack reminders. They get logins only when `TEST_EBOARD_PASSWORD` is set. See [docs/superpowers/2026-11-18-fake-eboard-users.md](../../docs/superpowers/2026-11-18-fake-eboard-users.md).

The passwords are **never** in the repository. Ask a Website team lead for them. They are kept:

- in the club password manager's shared folder, or
- in a private message to one person who is on the Vercel team.

Never post them in a group channel. If that happens, rotate them (see below).

### Database migrations on preview

The **Preview database migrations** workflow (`.github/workflows/migrate-preview.yml`) runs `prisma migrate deploy` against preview when a pull request changes `prisma/migrations/`. It needs no approval.

Because the database is shared, a migration from your pull request is live for **every** preview, and it stays there if the pull request is closed. To go back to `main`, run **Reset preview database**.

By hand, with `.env.preview` filled in (copy `.env.preview.example`):

```bash
npm run db:status:preview
npm run db:migrate:preview
```

### Reset and seed

The **Reset preview database** workflow (`.github/workflows/reset-preview.yml`) puts preview back to a known state:

1. It drops every app table, with migrations from closed pull requests.
2. It applies the migrations on `main`.
3. It seeds the officers, 50 made-up members and one semester of meetings. Past meetings have closed attendance, and future meetings have none. On a branch whose seed has them, it also adds the fake e-board, their Slack links, and e-board tasks at every reminder stage (see `seedTasks` in `scripts/seed/seed.mjs`). The workflow seeds from `main`, so for those, seed from your laptop on the branch.
4. It creates the 4 test logins, or resets their passwords.

Other login accounts are kept. **It deletes everything that people made on preview, so tell the team first.** To run it: GitHub → Actions → Reset preview database → Run workflow.

The same steps from your laptop (needs `SUPABASE_SECRET_KEY` in `.env.preview`):

```bash
npm run db:reset:preview
```

To seed again without dropping the tables, use `npm run db:seed:preview`. Add `SEED_SKIP_LOGINS=1` to seed the app data only: the test logins keep their passwords, and `.env.preview` needs only `DATABASE_URL` and `DIRECT_URL`. The seed script (`scripts/seed/seed.mjs`) empties the app tables first, so every run gives the same data. Dates are counted from the day it runs. The script refuses to run against production.

`npm run db:seed:local` seeds your **local** database the same way. It deletes your local app data first.

The seed reads 2 git-ignored files in `supabase/seed/`:

- `officers.json`: the teams, and the officers with their teams. Copy `officers.example.json` to start. On GitHub it is the `PREVIEW_SEED_OFFICERS` secret.
- `.env.test-accounts`: the 4 test passwords. Copy `.env.test-accounts.example` to start. On GitHub it is the `PREVIEW_TEST_ACCOUNTS` secret.

### Rotating the test passwords

1. In `supabase/seed/.env.test-accounts`, put a new password after each `=`. Make each one with `openssl rand -base64 18`.
2. Save the file as the GitHub secret:
   ```bash
   grep '^TEST_' supabase/seed/.env.test-accounts | gh secret set PREVIEW_TEST_ACCOUNTS --repo teach-firstbyte/firstbyte-web-dashboard --env "Preview database"
   ```
3. Run **Reset preview database** (or `npm run db:seed:preview`). Until you do this, the old passwords still work.
4. Share the new passwords the private way described in [Test logins](#test-logins).

To change the officer list, edit `supabase/seed/officers.json`. Then save it with `gh secret set PREVIEW_SEED_OFFICERS --repo teach-firstbyte/firstbyte-web-dashboard --env "Preview database" < supabase/seed/officers.json`, and run Reset.

### Where the preview settings live

- **GitHub → Settings → Environments → Preview database** (no reviewers, any branch): `DATABASE_URL` (Transaction pooler, port 6543), `DIRECT_URL` (Session pooler, port 5432), `SUPABASE_SECRET_KEY` (the preview project's secret key), `PREVIEW_SEED_OFFICERS` and `PREVIEW_TEST_ACCOUNTS`.
- **GitHub repository secret:** `KEEPALIVE_PREVIEW_DATABASE_URL` (see [Keeping the database awake](#-keeping-the-database-awake)).
- **Vercel → firstbyte-dashboard → Settings → Environment Variables**, Preview entries: `DATABASE_URL` (the Transaction pooler string with `?pgbouncer=true`; without it every page fails with `prepared statement "s1" does not exist`), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `CHECKIN_SECRET` and `CRON_SECRET`. All of them are for the preview project. Never give a Preview entry a production value.
- **Supabase → preview project → Authentication → URL Configuration:**
  - Site URL: one website preview URL, with no `/dashboard` at the end. Today it is the preview of the branch that set this up. Change it if that preview stops working.
  - Redirect URLs: `https://*-firstbyte-neu.vercel.app/dashboard/**`. In Supabase's patterns, `*` matches inside one part of the host name.

  To change them from the command line: run `npx supabase login`, then `npx supabase config push --project-ref kszxdakaiyispmrgicim` from a folder whose `supabase/config.toml` lists only these 2 settings under `[auth]`. Settings that the file does not list are not changed. Run `npx supabase config diff` first to see the changes.

### Emails on preview do not work with the app's links

The preview project is on Supabase's Free plan and uses Supabase's own email sender. On that setup, Supabase does not let you change the email templates. Production uses changed templates that point at `/dashboard/auth/confirm`, so signup confirmation and password reset emails from preview have links that the app does not understand. Supabase's own sender also sends only a few emails each hour, and only to people in the Supabase organization.

So on preview, use the [test logins](#test-logins). They are confirmed already and need no email. To test the email flows, use your local stack (its emails show at http://localhost:54324). To make them work on preview, give the preview project its own email sender (Authentication → SMTP Settings), then copy production's 4 templates.

---

## 💬 FirstByte Tasks Slack bot

The e-board task board reminds people with direct messages from its own Slack app, **FirstByte Tasks**. It is a different app from the newsletter bot: it has its own token (`TASKS_SLACK_BOT_TOKEN`), and no code is shared. It only sends DMs. It never posts in channels and doesn't read messages.

For now it lives only in the **FirstByte Slack Dev Sandbox** (`firstbyteslac-gtj8504.slack.com`). The president and Hector decide when it moves to the real workspace. When it does, it needs a new install, a new token, and every e-board member's Slack link set up again, because member IDs differ between workspaces.

### What's where

- `slack-tasks-app/manifest.json`: the app's settings. It asks for two bot scopes, `chat:write` (send a message) and `im:write` (open a DM with someone). Nothing else. Its DM window is read-only (`features.app_home`: `messages_tab_enabled: true`, `messages_tab_read_only_enabled: true`): members can read the bot's DMs but can't type back, and the app has no scopes or endpoints for reading messages.
- `src/lib/tasks/slack.ts`: `sendSlackDm(memberId, message)`, server-only. It opens a DM with `conversations.open`, then posts with `chat.postMessage`. It never throws. It resolves to `{ ok: true }` or `{ ok: false, error, retryable }`, so a caller can retry or mark a reminder "not delivered". Without a token it logs a line and sends nothing.
- `src/lib/tasks/slack-messages.ts`: the DM texts from the mockup's Slack DMs screen (assigned, 2 days before, due today, overdue to the owner and to the creator, due date changed, reassigned away). The welcome DM is in `src/lib/tasks/slack-welcome.ts`.
- `src/lib/tasks/slack-member-id.ts`: checks a member ID (`U` or `W`, then 8 to 11 letters or digits).
- `slack_links` table (`SlackLink` in the schema): one row per linked person, with their member ID and which super admin set it. It's a separate table, not a column on `users`, so the ID can't ride along with the many reads of whole user rows. The database refuses a badly formed ID (a CHECK constraint) and the same ID on two people (unique). RLS is on, like every table.
- `src/server/tasks/slack-links.ts`: the only code that reads member IDs. Listing, linking and unlinking are for super admins only. `slackMemberIdForDm(userId)` is for the reminder jobs and the welcome DM: it returns null for anyone unlinked or no longer on the e-board.
- Everyone else gets a boolean instead: each task's `owner.slackConnected`, and `slackConnected` on `/api/tasks/owners`. False means "Not connected to Slack".

### Install it in the sandbox

Only a sandbox admin can do this (Hector).

1. Open [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From a manifest**.
2. Pick **FirstByte Slack Dev Sandbox**, paste the contents of `slack-tasks-app/manifest.json`, and create the app.
3. **Install App** → **Install to FirstByte Slack Dev Sandbox** → **Allow**. Slack should list only two permissions: sending messages as the app, and starting direct messages with people.
4. **App Home** → **Show Tabs**: check that **Messages Tab** is on and that **Allow users to send Slash commands and messages from the messages tab** is off. The manifest sets this (`messages_tab_read_only_enabled: true`), so the DM window is read-only. If that box is checked, uncheck it and save.
5. **OAuth & Permissions** → copy the **Bot User OAuth Token** (`xoxb-...`).
6. Put it in `apps/dashboard/.env.local` as `TASKS_SLACK_BOT_TOKEN=xoxb-...`. For previews, add it in Vercel → firstbyte-dashboard → Settings → Environment Variables as a **Preview** entry. Don't add a Production entry yet. Never commit the token or paste it in a channel.

If you change the scopes in the manifest later, paste the new manifest under **App Manifest** and install the app again.

### Send a test DM

From `apps/dashboard`, with the token in `.env.local`:

```bash
npm run slack:tasks:test-dm -- U0CK0SKF78E
```

That DMs one sandbox member (here Maya, from the [fake e-board](../../docs/superpowers/2026-11-18-fake-eboard-users.md)) a sample "due today" reminder. The DM shows up under **Apps → FirstByte Tasks** in their Slack. Only Maya, Daniel and Jordan have joined the sandbox, so only they can get DMs. The others fail with an error such as `user_not_found` or `channel_not_found`.

To find someone's member ID: in Slack, open their profile, click **⋮**, then **Copy member ID**.

### Link e-board members

Open **Tasks → Slack setup** (`/dashboard/tasks/slack`). Only super admins (the president, VP and website lead) can open it. Anyone else is sent to Home, and its API (`GET /api/tasks/slack`, `PUT` and `DELETE /api/tasks/slack/<userId>`) answers them with a 403.

The page lists every approved E-Board team member. Use **Link** to paste a member ID, **Change** to replace it and **Unlink** to remove it. A bad ID is refused with a message saying where to find the real one. An ID already linked to someone else is refused too, naming that person. Someone who isn't on the E-Board team can't be linked. Deleting an account removes its link.

Unlinked people show "Not connected to Slack" on the board and get no reminders. Their next reminder after linking goes out as usual.

**Welcome DM.** Linking someone, or changing their member ID (say, for a new workspace), sends that person one hello DM from the bot. Saving the same ID again sends nothing. It says who the bot is, which DMs they'll get (assigned or due date changed, 2 days before, on the due date at 9am, overdue), and, for super admins only, when the weekly summary comes (the club's setting). It ends with an **Open your tasks** link and a note that they can't reply and should ask the president if anything's wrong. It goes out right after the response (Next's `after()`), so linking stays fast. A failed send is logged and dropped: the link is saved either way, and nothing about the welcome is recorded in the database. The success message on Slack setup says whether a welcome DM is on its way, or that none went out because `TASKS_SLACK_BOT_TOKEN` isn't set. Code: the text and the rule are pure functions in `src/lib/tasks/slack-welcome.ts` (tested in `slack-welcome.test.ts`), and the send is `src/server/tasks/slack-welcome.ts`.

### Reminders

Every reminder is a DM, and every time is Boston time.

| DM | To | Sent by |
|---|---|---|
| Assigned | The new owner | Creating or reassigning a task |
| No longer yours | The previous owner | Reassigning a task |
| Due date changed (old date, new date, who) | The owner | Changing the due date |
| Due in 2 days | The owner | The hourly job, from 9am that day |
| Due today | The owner | The hourly job, from 9am on the due date |
| 1 day overdue | The owner, and the creator if they aren't the owner | The hourly job, from 9am the day after |

- Nobody gets a DM about a change they made themselves, except "Assigned" (a task you make for yourself says "You have a new task").
- Nothing goes out once a task is Done, or while it needs a new owner. A reminder already waiting is cancelled when it no longer fits (the task was reassigned, or its date moved).
- A new owner or a new due date restarts the schedule from that moment (`tasks.reminders_from`). A task created, handed over or moved to a date that's today or already past gets only its event DM. A reminder day with no run at all is dropped, not sent late.
- Code: the rules are pure functions in `src/lib/tasks/reminders.ts` (tested in `reminders.test.ts`). Recording and sending are in `src/server/tasks/reminders.ts`.

**Sent once.** Every DM is a row in `task_reminders` before it's sent. Its unique key is task, kind, recipient, due date and, for event DMs, the time of the change, so a job that runs twice records it once. A row is sent only by whoever moves it from `PENDING` to `SENDING`, so two runs at once can't both send it. A row stuck in `SENDING` for 15 minutes (the function died mid-send) is marked `FAILED`, not resent, because Slack may already have it.

**When.** Event DMs are recorded with the change and sent right after the response (Next's `after()`). The hourly cron job, `/api/cron/task-reminders` in `vercel.json`, records the scheduled ones and sends anything still waiting.

**Failures.** If Slack is down, rate limits us or the bot is broken (a bad token, a missing scope), the send is retried every hour for a day. Then the row is `FAILED` and the task shows "⚠ Reminder not delivered" until a later reminder reaches that person, or the task is Done. A problem with the person (such as `user_not_found`) fails at once. Someone unlinked or off the e-board is `SKIPPED`, and so is everything when `TASKS_SLACK_BOT_TOKEN` isn't set. Neither counts as a failure.

**Cron on preview and locally.** Vercel runs cron jobs on production only. To run the reminder job on a preview or locally, call it with that deployment's `CRON_SECRET`:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3001/dashboard/api/cron/task-reminders
```

It answers with counts (`queued`, `sent`, `retrying`, `failed`, `skipped`, `cancelled`), never names or member IDs. The weekly summary's counts are under `summary`.

### Weekly summary

Once a week the bot DMs each super admin who is on the e-board and linked to Slack: what's overdue or due in the next 7 days, grouped by person; every open task that needs a new owner; and the e-board members who aren't connected to Slack. The layout is the mockup's "Weekly summary".

- **When.** Mondays at 9am Boston time unless a super admin changes it under **Weekly summary** on Slack setup (`GET` and `PUT /api/tasks/summary`, 403 for anyone else). There's one setting for the club, the single row of `task_settings`. The page shows when the next one goes out.
- **Sent by** the same hourly job. It's due from the set hour until the same hour the next day, so a late run still sends it. The time is read off Boston's clock, so daylight saving can't move it.
- **Once a week.** Each DM is a `task_summaries` row first, and the database allows one row per person per week (keyed by the week's Monday). A run that's late, runs twice or overlaps another records it once. Moving the day later in a week that already had its summary doesn't send a second one. Sending, retries and "stuck" rows work like the reminders.
- **Code:** the rules (is it due, the next one, what it says) are pure functions in `src/lib/tasks/weekly-summary.ts` (tested in `weekly-summary.test.ts`). Recording and sending are in `src/server/tasks/weekly-summary.ts`.

### When an owner leaves

Taking someone off the E-Board team, or deleting their account, keeps their tasks. Their open tasks show "Needs a new owner" at the top of the board, get no more reminders (any waiting one is cancelled) and are listed in the weekly summary until someone reassigns them. Nothing is deleted: an account is never hard-deleted, and `tasks.owner_id` and `created_by_id` are `ON DELETE RESTRICT`. The rule is `ownerNeedsReplacing` in `src/lib/tasks/owners.ts`, and `owner-leaves.test.ts` follows a task through every step.

---

## 🛠️ Starting the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Project Features

- **User Management:** Track club members and team memberships
- **Team Organization:** Manage different club teams
- **Meeting Tracking:** Schedule and track meetings, workshops, and events
- **Attendance System:** Record and monitor member attendance
- **Feedback Collection:** Gather feedback on meetings and events
- **Analytics Dashboard:** View participation and engagement metrics

---

## 📝 Development Notes

- All database operations go through Prisma ORM
- UI components use shadcn/ui and Tailwind CSS
- Dashboard is responsive and accessible
- Use TypeScript throughout
- Tests use Node's built-in test runner, with no extra packages. Put a `*.test.ts` file next to the code under `src/` and run `npm test`. Import other files by relative path with the `.ts` extension (`./slack.ts`), since Node runs the TypeScript directly and doesn't know the `@/` alias. CI runs the tests on every pull request.

---

## 🚨 Troubleshooting

**Common Issues:**

- `"Environment variable not found: DATABASE_URL"`
  - Make sure `.env.local` exists and is filled out
  - Restart the dev server after any changes

- `"Can't reach database server"`
  - Confirm your Supabase project is active and credentials are correct
  - Try using the pooled connection string

- `"Module not found" errors`
  - Run `npm install` to ensure all dependencies are present

- `"CHECKIN_SECRET is not set"`
  - The attendance check-in feature needs this variable in `.env.local`
  - Generate one with `openssl rand -hex 32`, then restart the dev server

**If you’re stuck:**

- Check terminal output for error messages
- Verify your environment variables
- Contact Ameeka and Nick

---

## 🎯 Future Roadmap

- File upload capabilities
- Some form of Jira board integration for task management
- Admin dashboard for content management
- Individual user workspaces
- iOS app with push notifications (for example, officers told when a member says they can't make it)

---

**For any questions or access requests, contact the project admins (Ameeka and Nick).**
