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
3. It seeds the officers, 50 made-up members and one semester of meetings. Past meetings have closed attendance, and future meetings have none.
4. It creates the 4 test logins, or resets their passwords.

Other login accounts are kept. **It deletes everything that people made on preview, so tell the team first.** To run it: GitHub → Actions → Reset preview database → Run workflow.

The same steps from your laptop (needs `SUPABASE_SECRET_KEY` in `.env.preview`):

```bash
npm run db:reset:preview
```

To seed again without dropping the tables, use `npm run db:seed:preview`. The seed script (`scripts/seed/seed.mjs`) empties the app tables first, so every run gives the same data. Dates are counted from the day it runs. The script refuses to run against production.

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

## 📰 Newsletter (prototype)

A weekly email to members: what's coming up, and what each team is working on. An AI writes each team's first draft from that week's GitHub, Slack and meetings. The team lead edits and approves it, a final approver signs off, and then it is emailed. The full design is in [`docs/superpowers/specs/2026-10-17-newsletter-design.md`](../../docs/superpowers/specs/2026-10-17-newsletter-design.md).

### Where it is switched on

- **Preview deployments and `npm run dev`:** on.
- **Production:** off. The Newsletter tab, pages and home card don't appear until `NEWSLETTER_ENABLED=true` is set in Vercel. So merging this changes nothing on teachfirstbyte.com.

### What is real and what is sample

| Part | In the prototype |
|---|---|
| GitHub | Real. Merged pull requests from this repo in the past 7 days, read through GitHub's public API with no key. |
| Slack | **Sample messages**, in `src/lib/newsletter/sampleSlack.ts`. They include traps on purpose (a phone number, a private channel, a DM, someone's GPA), so you can see the safeguards work. |
| Dashboard | Real. Each team's meetings and how many came. Totals only. |
| Claude | Real, if `ANTHROPIC_API_KEY` is set. Without it, each draft is empty and says why. |
| Email | Real, through Resend, but **only to `NEWSLETTER_TEST_RECIPIENTS`**. |
| Photos | Sample photos in `public/newsletter-samples/`. Google Drive comes later. |

### The safeguards

All in `src/lib/newsletter/safeguards.ts`, and all plain code, not AI:

1. **Collect:** only the channels and repos in `src/lib/newsletter/sources.ts`. Never DMs or private channels.
2. **Clean:** phone numbers, emails, Google Docs links and the names of people outside the club are removed before the AI sees anything. Messages about one person's grades or attendance are left out.
3. **Write:** Claude has to list the source of every line.
4. **Check:** a line whose sources weren't really collected is deleted. A line based only on Slack talk is highlighted for the lead.
5. **Save:** only the lines and their source links are stored. Raw Slack messages are not.

Then the team lead approves their part, and a final approver approves the issue. **The send step refuses anything without final approval.**

### Who can do what

- **Team leads** (`TeamRole.LEAD`) edit, approve or skip their own team's draft. Officers can edit any team's draft.
- **Final approvers** (`users.newsletter_approver`) give the whole issue final approval. Only a super admin can choose them (Newsletter page → Final approvers), and nobody can change their own setting. That's how the website lead, who is also a super admin, is kept from approving.
- **Everyone** can read sent issues, see "What the AI can see", and unsubscribe.

### Trying it on a preview

Vercel only runs scheduled jobs on production, so on a preview the Newsletter page has officer-only buttons that run the same code by hand.

1. Log in as `test-admin@firstbyte.test`. On **Newsletter → Final approvers**, turn on `test-officer`.
2. Press **Run draft job now**. It takes up to a minute: the AI drafts every team at once.
3. Open a team, edit the lines, pick a photo, and press **Approve update**. Skip or approve the others.
4. Log in as `test-officer@firstbyte.test`, open **Preview and approve**, and press **Give final approval**.
5. Press **Send now**. The email goes to `NEWSLETTER_TEST_RECIPIENTS` only.
6. As `test-member@firstbyte.test`, the home page shows the "new issue" card.

**Start over** deletes this week's issue so you can run it again. Remember that every preview shares one database (see [Database migrations on preview](#database-migrations-on-preview)).

### Trying it on your own computer, with a local AI

No Claude key and no real email needed. `scripts/newsletter-fake-apis.mjs` stands in for both: it answers the dashboard's Claude requests with a model running in [Ollama](https://ollama.com), and saves emails as files instead of sending them. It talks to Ollama through Ollama's own API, because Ollama's Claude-compatible API doesn't support the JSON shape the draft step asks for.

You need Node.js 24 (see `.nvmrc`), [Docker Desktop](https://www.docker.com/products/docker-desktop/) for the local database, and Ollama.

1. **Get a model.** On a Mac with 32 GB of memory, `qwen2.5:14b` (about 9 GB) runs comfortably. `qwen2.5:7b` is faster and rougher.
   ```bash
   ollama pull qwen2.5:14b
   ```
2. **Get the code.**
   ```bash
   git clone https://github.com/teach-firstbyte/firstbyte-web-dashboard
   cd firstbyte-web-dashboard
   git checkout feat/newsletter-prototype
   npm install
   ```
3. **Start the local Supabase stack** (database and logins, in Docker). It prints the keys you need next. `npx supabase status` prints them again.
   ```bash
   cd apps/dashboard
   npx supabase start
   ```
4. **Make `apps/dashboard/.env.local`:**
   ```bash
   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
   DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=   # "Publishable" from supabase status
   SUPABASE_SECRET_KEY=                    # "Secret" from supabase status
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   CHECKIN_SECRET=                         # openssl rand -hex 32

   # The fake APIs. The keys only need to be non-empty.
   ANTHROPIC_API_KEY=fake
   ANTHROPIC_BASE_URL=http://127.0.0.1:4010
   RESEND_API_KEY=fake
   RESEND_BASE_URL=http://127.0.0.1:4010
   NEWSLETTER_FROM=FirstByte <news@teachfirstbyte.com>
   NEWSLETTER_TEST_RECIPIENTS=you@example.com
   ```
5. **Make the tables and the test data.** Copy `supabase/seed/officers.example.json` to `officers.json` and `supabase/seed/.env.test-accounts.example` to `.env.test-accounts`, and put a password after each `=` in the second one. Then:
   ```bash
   npx dotenv -e .env.local -- npx prisma migrate deploy
   npm run db:seed:local
   ```
6. **Run three things, each in its own terminal, from the repo root:**
   ```bash
   npm run newsletter:fake-apis -w @firstbyte/dashboard
   npm run dev:dashboard
   npm run dev:web
   ```
7. Open http://localhost:3000/dashboard, log in with a test account, and follow [Trying it on a preview](#trying-it-on-a-preview). The by-hand buttons show up in development too.
8. Emails you "send" are listed at http://127.0.0.1:4010/, with the photos in place.

Useful switches for the fake APIs:

- `-- --canned` skips Ollama and answers with fixed lines that cite real sources, plus one made-up source that the check step should drop. Handy for checking the safeguards quickly.
- `OLLAMA_MODEL=qwen2.5:7b` picks another model. `OLLAMA_URL`, `FAKE_PORT` and `OUTBOX_DIR` are there too.

To use a real Claude key instead, set `ANTHROPIC_API_KEY` to it and delete the `ANTHROPIC_BASE_URL` line. Do the same with Resend to send real email. Test sends still go only to `NEWSLETTER_TEST_RECIPIENTS`.

Never set `ANTHROPIC_BASE_URL` or `RESEND_BASE_URL` in Vercel. The fake APIs are for your own computer only.

### Settings

Set these in **Vercel → firstbyte-dashboard → Settings → Environment Variables**, on **Preview** only for now:

| Name | What it is |
|---|---|
| `ANTHROPIC_API_KEY` | A Claude Console API key. Use a separate key named "preview". |
| `RESEND_API_KEY` | A Resend API key with sending access only. Use a separate key for preview. |
| `NEWSLETTER_FROM` | The sender, e.g. `FirstByte <news@teachfirstbyte.com>`. The domain must be verified in Resend. |
| `NEWSLETTER_TEST_RECIPIENTS` | Comma-separated emails that get the test sends, e.g. yours and the president's. |
| `NEWSLETTER_MODEL` | Optional. Defaults to `claude-opus-5-5`. `claude-haiku-5-5` costs much less. |
| `GITHUB_TOKEN` | Optional. Without it GitHub allows about 60 requests an hour, shared with everything else on Vercel's servers. If a draft says GitHub couldn't be reached, add a fine-grained token with read-only access to public repos. |

At rollout, production also needs `NEWSLETTER_ENABLED=true`, and `NEWSLETTER_SEND_TO_MEMBERS=true` to email members instead of the test list. Emailing members is never possible on a preview, even with that set.

### Not built yet

- The weekly schedule (Monday draft, Thursday send) in `vercel.json`. Today the jobs run only from the buttons.
- Real Slack and Google Drive connections. The design document has the setup for both.

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
