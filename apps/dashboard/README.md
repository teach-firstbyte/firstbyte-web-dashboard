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

---

**For any questions or access requests, contact the project admins (Ameeka and Nick).**
