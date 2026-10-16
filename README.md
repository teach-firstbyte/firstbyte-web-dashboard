# FirstByte

Monorepo for the FirstByte website and club dashboard.

## Layout

```
apps/
├── web/          Public marketing site      Next 16, Tailwind v4, static
└── dashboard/    Club participation dashboard  Next 15, Tailwind v4, Supabase auth + Prisma/Postgres
```

The two apps are **independently built and deployed** and stitched together at
the URL level using [Next.js Multi-Zones](https://nextjs.org/docs/app/guides/multi-zones):

- `apps/dashboard` sets `basePath: "/dashboard"`.
- `apps/web` rewrites `/dashboard/:path*` to the dashboard deployment.

Visitors see a single site at `teachfirstbyte.com`, with the dashboard under
`teachfirstbyte.com/dashboard`. Neither app imports the other, so each keeps its own
`next.config`, root layout, middleware, and dependency versions.

## Getting started

Install once from the repo root — this is an npm workspace, so there is a single
lockfile and a single `node_modules` tree:

```bash
npm install
```

Run the marketing site:

```bash
npm run dev:web
```

Run the dashboard (needs `apps/dashboard/.env` and `.env.local`; ask an officer):

```bash
npm run dev:dashboard
```

To exercise the two together, run both and browse **only** the web app's port.
Hitting the dashboard's port directly bypasses the rewrite and hides
proxy-specific bugs.

## Scripts

Run from the repo root:

| Script | What it does |
| --- | --- |
| `npm run dev:web` | Marketing site dev server |
| `npm run dev:dashboard` | Dashboard dev server |
| `npm run build` | Build both apps |
| `npm run build:web` / `build:dashboard` | Build one app |
| `npm run lint:dashboard` | ESLint, `--max-warnings=0` |
| `npm run typecheck:dashboard` | `tsc --noEmit` |
| `npm run format:check:dashboard` | Prettier check |
| `npm run test:dashboard` | All Vitest tests (needs local Supabase, see below) |
| `npm run test:unit:dashboard` | Only the tests that need no database |

To run any other script in one workspace: `npm run <script> -w @firstbyte/web`.

### Dashboard tests

The dashboard has two kinds of [Vitest](https://vitest.dev) tests:

- `*.test.ts` test plain functions. They need no database.
- `*.db.test.ts` test services against a real Postgres database. Start local
  Supabase first. The tests use their own database, `firstbyte_test`, on the
  same Postgres. They never touch the `postgres` database that the dev server
  uses. Each run empties `firstbyte_test` and applies any new migrations.

To use another test database, set `TEST_DATABASE_URL`. Its name must end in
`_test` and it must be on your own machine, because each run deletes its data.

> `apps/web` has no ESLint config yet, and `next.config.mjs` sets
> `typescript.ignoreBuildErrors: true`, so its type errors do not fail builds.
> Both are tracked as follow-up work.

## Deployment

Two Vercel projects share one Git repository:

| Project | Root Directory | Domain |
| --- | --- | --- |
| `firstbyte-web` | `apps/web` | `teachfirstbyte.com` |
| `firstbyte-dashboard` | `apps/dashboard` | internal `.vercel.app` URL only |

Because this is a real npm workspace, Vercel automatically **skips builds for
the app you didn't touch** — change only `apps/dashboard/**` and the marketing
site is not redeployed. Editing the root lockfile rebuilds both.

Two settings are load-bearing and easy to get wrong:

- **Deployment Protection must be off on the dashboard project.** Left on, the
  rewrite returns Vercel's login wall instead of the dashboard.
- The dashboard's `serverActions.allowedOrigins` must include the public domain,
  or every form submission fails with "Invalid Server Actions request" while
  pages still render normally.

### Auth configuration

Everything auth-related is configured in **Supabase**, not Google. With
Supabase-hosted OAuth, Google redirects to Supabase's own callback
(`https://<project-ref>.supabase.co/auth/v1/callback`) and never to this app, so
**the Google Cloud console needs no change** when app URLs move. Only Supabase
sees your app's URLs.

**Authentication → URL Configuration**

- Site URL: `https://teachfirstbyte.com`
- Redirect URLs (all on the *web* origin — users always arrive through the proxy):
  ```
  https://teachfirstbyte.com/dashboard/**
  http://localhost:3000/dashboard/**
  ```
  `**` crosses `/` separators; `*` does not.

**Authentication → Email Templates**

These are customized to point at this app's `/auth/confirm` page rather than
Supabase's default verify endpoint, so each one needs the `/dashboard` prefix:

```
{{ .SiteURL }}/dashboard/auth/confirm?token_hash={{ .TokenHash }}&type=signup
```

Applies to Confirm signup, Reset password, Magic link, and Change email —
`src/app/auth/confirm/page.tsx` handles all four types. Getting this wrong sends
new members a confirmation link that 404s, and it will not show up in ordinary
testing because existing accounts never see these emails.

## CI

`.github/workflows/ci.yml` runs on every PR. Path filtering happens at the
**job** level via `dorny/paths-filter`, not in the `on:` trigger — a workflow
skipped by trigger-level `paths:` leaves required checks pending forever, while a
job skipped by an `if:` reports success.
