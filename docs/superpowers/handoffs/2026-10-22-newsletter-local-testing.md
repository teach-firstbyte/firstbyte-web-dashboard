# Handoff: test the newsletter prototype locally with Ollama

For a Claude Code session running on the user's MacBook Pro (M1 Max, 32 GB),
inside a clone of `teach-firstbyte/firstbyte-web-dashboard`. Written by the
cloud session that designed and built the prototype. Delete this file before
the branch is merged.

## What the user wants from you

Get the newsletter prototype running on this Mac with a **local Ollama model
instead of Claude**, and **fake email**, using only sample data, so the user
can try the whole flow and show it to the club president as a proof of
concept. Then help fix whatever the local run turns up.

Talk to the user in plain, short English. They are the club's website lead.

## Ground rules from the user

- **Ask before you commit or push.** Earlier in the project the user said
  "nothing implemented until I give the green light" and "do not commit or
  push". They later approved building and pushing the prototype, but treat
  each new commit and push as needing a yes.
- **Everything the AI reads stays sample data for now.** No live GitHub,
  Slack or Google Drive. That was a deliberate decision for the proof of
  concept.
- **Never put `ANTHROPIC_BASE_URL` or `RESEND_BASE_URL` in Vercel.** The fake
  APIs are for this computer only.
- **Don't seed into another project's database.** `npm run db:seed:local`
  empties the app tables first (see the safety check below).

## Where things are

- **Branch:** `feat/newsletter-prototype` (pushed). Commits on top of `main`:
  1. `Add the weekly newsletter design`
  2. `Build the newsletter prototype for preview deployments`
  3. `Add fake Claude and Resend APIs for trying the newsletter locally`
  4. `Use sample pull requests instead of live GitHub`
- **Design:** `docs/superpowers/specs/2026-10-17-newsletter-design.md`, with
  mockups and architecture diagrams as `.html` files next to it.
- **How to run and test:** `apps/dashboard/README.md`, section
  "📰 Newsletter (prototype)", especially "Trying it on your own computer,
  with a local AI". This handoff repeats the steps with the Mac specifics.
- **No pull request is open yet.** The user hasn't asked for one.

## How the prototype works, briefly

Weekly flow: an AI drafts each team's update → the team lead edits and
approves or skips → a final approver (Brand and Marketing lead, President or
VP; **not** the website lead) gives final approval → the issue is emailed and
a "new issue" card shows on members' dashboard home.

On only for previews and `npm run dev` (`src/lib/newsletter/enabled.ts`). Off
in production until `NEWSLETTER_ENABLED=true`. Preview and dev show
officer-only buttons, "Run draft job now" and "Send now", because Vercel only
runs cron jobs on production.

Key files, all under `apps/dashboard/`:

| File | What it does |
|---|---|
| `src/lib/newsletter/safeguards.ts` | The 5 safeguard steps as pure functions: collect switched-on only (no DMs/private), clean (phones, emails, Google Docs links, non-member names; drop messages about one person's grades), check (drop AI lines whose source ids weren't collected; flag Slack-only lines). |
| `src/lib/newsletter/sampleSlack.ts`, `sampleGitHub.ts` | The sample data, with deliberate traps. |
| `src/lib/newsletter/sources.ts` | Which channels/repos each team "has". Rendered on "What the AI can see". |
| `src/lib/newsletter/draft.ts` | Calls Claude via `@anthropic-ai/sdk` with structured output (`betaZodOutputFormat`), model from `NEWSLETTER_MODEL` (default `claude-opus-5-5`), server-side fallbacks on. Never throws; returns `{ ok: false, error }`. |
| `src/lib/newsletter/email.ts` | Email HTML/text, Resend send, one email per recipient, sample photos attached inline (`contentId`, base64). |
| `src/server/newsletter/jobs.ts` | `runDraftJob(now)` and `sendIssue(issueId, origin, now)`. Send refuses anything not `APPROVED`. |
| `src/server/newsletter/{queries,mutations,schema,select}.ts` | Data layer and permission rules. |
| `src/app/newsletter/**` | Pages and server actions (`actions.ts`). |
| `scripts/newsletter-fake-apis.mjs` | Local stand-in for Claude (`POST /v1/messages` → Ollama `/api/chat` with `format` = the JSON schema) and Resend (`POST /emails` → saved HTML files, listed at `GET /`). `--canned` skips Ollama. |
| `prisma/migrations/20261017120000_newsletter/` | New tables, two new `users` columns, row-level security on. Already applied to the shared preview database. |

Repo rules to keep (enforced by lint, typecheck and CI):
- Only `src/server/**` touches Prisma. Pages and actions call services.
- No `try/catch` inside `src/server/` (see the header of `src/server/errors.ts`). External-API error handling lives in `src/lib/newsletter/`.
- New Prisma enums must be mirrored in `src/lib/enums.ts`; `src/lib/enums.prisma-sync.ts` checks it.
- Migrations must be safe for the code already live (README, "Writing a migration that's safe to deploy").
- Before any commit, run from the repo root: `npm run format:check:dashboard`, `npm run lint:dashboard`, `npm run typecheck:dashboard`, `npm run build:dashboard`, `npm run verify:no-prisma-client:dashboard`. The build needs env placeholders if `.env.local` is missing; see `.github/workflows/ci.yml`.

## What was already verified (in the cloud session)

- All CI checks pass on the branch.
- The migration applies cleanly from an empty database, matches the schema
  exactly, and turns on RLS.
- End-to-end against a real Postgres with stand-ins for Claude and Resend:
  drafts for the 5 open teams (not E-Board); the AI never received private
  messages, DMs, the phone number, the GPA message, the Docs link, outsider
  names or attendee names; made-up sources dropped; leads limited to their
  team; edits keep sources; no send without final approval; email only to
  `NEWSLETTER_TEST_RECIPIENTS`; nobody can make themselves an approver; reads
  counted; home card clears; stale unapproved weeks become `NOT_SENT`.
- The fake APIs, in both `--canned` and Ollama mode (Ollama itself was a
  stand-in there), with everything working offline.

**Never verified:** the pages in a real browser (no Supabase auth was
available in the cloud), a real Ollama model's draft quality, a real Claude
call, and a real Resend send. That's what this local run is for.

## Setting up this Mac

The user has **OrbStack** (not Docker Desktop) and says **Supabase is already
running**.

### 1. Check the running Supabase is this repo's

The project name in `apps/dashboard/supabase/config.toml` is
`infrastructure-dashboard`.

```bash
docker ps --format '{{.Names}}' | grep supabase_db
```

- `supabase_db_infrastructure-dashboard` → it's this repo's stack. Carry on.
- Anything else → **stop.** It's another project, and seeding would empty
  that project's `users`, `teams`, `meetings` and related tables. Ask the
  user. Usually: `npx supabase stop` in that project's folder, then
  `npx supabase start` in `apps/dashboard`. With OrbStack, if `vector` or
  `logflare` fail to start, use `npx supabase start -x vector,logflare`.

### 2. Tools

```bash
node -v            # needs v24 (.nvmrc). If not: brew install node@24
docker context show   # should be orbstack
ollama --version   # if missing: brew install ollama
```

### 3. Model

```bash
ollama serve   # in its own tab, unless the Ollama app is already running
ollama pull qwen2.5:14b
```

`qwen2.5:7b` is the faster fallback.

### 4. Code

```bash
git fetch origin && git checkout feat/newsletter-prototype && git pull
npm install
```

### 5. `apps/dashboard/.env.local`

Get the keys with `npx supabase status` (run in `apps/dashboard`). Don't
overwrite an existing `.env.local` without asking; merge into it.

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=   # "Publishable key"
SUPABASE_SECRET_KEY=                    # "Secret key"
NEXT_PUBLIC_APP_URL=http://localhost:3000
CHECKIN_SECRET=                         # openssl rand -hex 32

ANTHROPIC_API_KEY=fake
ANTHROPIC_BASE_URL=http://127.0.0.1:4010
RESEND_API_KEY=fake
RESEND_BASE_URL=http://127.0.0.1:4010
NEWSLETTER_FROM=FirstByte <news@teachfirstbyte.com>
NEWSLETTER_TEST_RECIPIENTS=you@example.com
```

### 6. Tables and test data (only after step 1 confirmed the right stack)

In `apps/dashboard`:

```bash
cp -n supabase/seed/officers.example.json supabase/seed/officers.json
cp -n supabase/seed/.env.test-accounts.example supabase/seed/.env.test-accounts
```

The user puts a password after each `=` in `supabase/seed/.env.test-accounts`
(or generate them with `openssl rand -base64 18` and tell the user). Both files
are git-ignored; never commit them. Then:

```bash
npx dotenv -e .env.local -- npx prisma migrate deploy
npm run db:seed:local
```

The seed makes 4 test logins (`test-admin`, `test-officer`, `test-member`,
`test-pending`, all `@firstbyte.test`), 50 made-up members, and a semester of
meetings, including a weekly workshop per team, so every team has meetings in
the draft window.

### 7. Run (three terminals, repo root)

```bash
npm run newsletter:fake-apis -w @firstbyte/dashboard   # should say "AI: Ollama qwen2.5:14b"
npm run dev:dashboard                                  # port 3001
npm run dev:web                                        # port 3000; browse this one
```

### 8. Walk through it at http://localhost:3000/dashboard

1. `test-admin` → Newsletter → **Final approvers** → turn on `test-officer` →
   **Run draft job now**.
2. Open a team → edit, pick a photo → **Approve update**. Approve or skip the rest.
3. `test-officer` → **Preview and approve** → **Give final approval** → **Send now**.
4. http://127.0.0.1:4010/ → the "sent" email, with the photo.
5. `test-member` → home page shows the "new issue" card. Opening it clears the card.

## Likely problems and what to check

- **"The AI couldn't be reached"** on a draft: Ollama not running or the model
  isn't pulled. The fake-APIs terminal prints the real error.
- **Draft fails with "answer couldn't be read"**: the model's JSON didn't
  match the schema. Check the `[ai]` lines in the fake-APIs terminal. Try
  `--canned` to confirm everything else works, then a different model. The
  fake server already inlines `$ref`s, turns thinking off, and puts the
  schema in the system prompt.
- **The draft job times out**: Ollama on 5 teams at once can be slow.
  `runDraftJob` drafts all teams in parallel (`Promise.all` in `jobs.ts`).
  Locally there's no Vercel limit, but Ollama queues requests, so a 14B model
  may take minutes. `qwen2.5:7b` helps.
- **Login fails**: seed not run, or the password doesn't match `.env.test-accounts`.
- **`/dashboard` 404 on port 3000**: the dashboard dev server (3001) isn't running.

## After it works: likely next steps (ask first)

- Fix any UI bugs the browser run finds. The pages have never been rendered
  with real data before.
- Open a **draft** pull request so CI runs (the user hasn't asked yet).
- Preview testing with real keys: in Vercel Preview only, set
  `ANTHROPIC_API_KEY`, `RESEND_API_KEY` (Resend is already verified for
  teachfirstbyte.com), `NEWSLETTER_FROM`, `NEWSLETTER_TEST_RECIPIENTS`.
- Later, per the design doc: the weekly schedule in `vercel.json`, a real
  Slack app, Google Drive photo upload (FirstByte's Google account is a
  personal Gmail, so OAuth with the `drive.file` scope, published "In
  production"; a service account won't work), and a photo consent step.
