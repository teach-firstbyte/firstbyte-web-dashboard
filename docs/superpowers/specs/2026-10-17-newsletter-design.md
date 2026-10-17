# Weekly newsletter: design

Status: approved for the prototype. The prototype is on the `feat/newsletter-prototype` branch; see "Newsletter (prototype)" in `apps/dashboard/README.md` for how to try it.

Items marked **(my call)** were chosen by the designer, not by the club. They
are sensible defaults that anyone on the eboard can change. Everything else was
decided in the brainstorming conversation.

Visual references, next to this file:

- `2026-10-17-newsletter-mockups.html`: screens 1 to 5 (lead's draft editor,
  final approval page, the email, meeting photos, the member home card).
- `2026-10-17-newsletter-architecture.html`: diagrams 1 to 4 (what talks to
  what, the draft pipeline, one week, photo upload).

The mockups are for layout and content. Where this document and the mockups
disagree, this document wins.

## Why

FirstByte members don't have an easy way to see what each team is working on,
or what's coming up. The eboard collects team updates in a weekly Google Doc
agenda, but people forget to fill it in, or write it from memory just before
the meeting.

The work already leaves traces during the week: code on GitHub, conversations
in Slack, and meeting photos the Brand and Marketing team takes. The newsletter
turns those traces into a weekly email, so nobody has to remember what happened
and members stay engaged.

The club also wants more AI projects, and wants to show that AI can be used
carefully. This feature is meant to be an example of that: useful, with
visible safeguards.

## What success looks like

After a semester:

- More members open the dashboard.
- More members come to events.

Both are measured with what exists or comes for free: event attendance (already
recorded, compared with the weeks before the first issue) and clicks from the
newsletter (each email link is tagged, and the dashboard counts arrivals).
The eboard confirmed this is enough. No general visit tracking is added. Email
"opened" counts are not used, because they are unreliable.

## Goals

1. A weekly newsletter emailed to members (about 60 people today), with:
   - upcoming meetings and collabs, and
   - a short update from each team.
2. An AI writes a first draft of each team's update from that week's Slack,
   GitHub and dashboard activity. The AI never sees photos; the lead picks
   one from that week's meeting photos.
3. Each team lead edits their team's draft, then approves it or skips the week.
4. One final approver signs off on the whole issue before it can send.
5. A "new issue" card on members' dashboard home page.
6. Brand and Marketing can add photos to a meeting from the dashboard, after
   the meeting. Photos are stored in Google Drive, not in Supabase.
7. A "What the AI can see" page that lists exactly what the AI can read.

## Non-goals (not in this project)

- RSVPs. The attendance rework (issue #111) removed `REGISTERED` because
  members never actually register for meetings. Adding RSVP back would bring
  back the same kind of record nobody keeps up.
- A member forum or replies. The email can link to the dashboard ("Read more"),
  but nothing more for now.
- Replacing the eboard's agenda Google Doc.
- An eboard-only weekly view.
- A Claude.ai subscription. The feature uses the Claude API with prepaid
  credits.

## Anti-goals (a failure even if it works)

- **It shares something private.** For example, a private Slack message, a
  member's phone number, or one person's grades or attendance.
- **It says a team did something they didn't.**
- **The eboard, and the president in particular, can't trust what the AI can
  see.**

The safeguards below exist to prevent these three.

## Constraints

- Keep running costs as low as possible. FirstByte is a small club.
- Don't fill up Supabase. Photos stay in Google Drive; the database stores only
  links to them.
- Build on the existing dashboard (`apps/dashboard`): Next.js on Vercel,
  Supabase Postgres through Prisma, the existing components and styles. Don't
  add a new app or a new host.
- Follow the repo's rules for migrations (README: "Writing a migration that's
  safe to deploy") and for preview vs production secrets.
- Nothing is ever sent without people approving it.

## Who does what each week

Days and times are **(my call)**.

| When | What happens | Who |
|---|---|---|
| Monday 9 AM | The draft job writes one draft per team. The issue's status is **Collecting**. | Automatic |
| Monday to Wednesday | Each team lead edits their draft, then approves it or skips the week. | Team leads |
| When every team has approved or skipped | The issue becomes **Ready for approval**. | Automatic |
| By Wednesday night | The final approver previews the whole issue and approves it. The issue becomes **Approved**. | Final approver |
| Thursday 9 AM | The send job emails an Approved issue and shows the home page card. The issue becomes **Sent**. | Automatic |

Rules:

- **One issue per week.** The draft job creates exactly one issue for the
  week it runs in.
- **The send job only sends an issue that is Approved.** It runs every hour
  from Thursday 9 AM to Sunday 11 PM **(my call)**. If the issue is approved
  late, for example Friday, it goes out at the next hourly run. If it's still
  not approved by Sunday night, it's marked **Not sent** and never goes out.
  Monday's draft job then starts a fresh issue; nothing carries over
  **(my call)**.
- **"Coming up" is worked out at send time**, not at draft time, so a late
  send never lists meetings that already happened. The approver's preview
  shows the list as it would be if sent right now.
- **The final approver can approve at any status before Sent**, including
  Collecting. "Ready for approval" only means every team has approved or
  skipped; it is a signal, not a gate.
- A team whose lead hasn't approved or skipped by the time the final approver
  approves is left out of that week's issue **(my call)**.
- The final approver gets a reminder Wednesday if the issue is still waiting
  **(my call: an in-app notice on the dashboard home; email reminders are
  optional)**.

### Who can approve

- **Team updates:** that team's lead (`TeamMember.role = LEAD`). Officers can
  also edit any team's draft **(my call)**.
- **The whole issue:** the **Brand and Marketing lead, the President, or the
  VP**. One approval is enough.
- **The website lead must not be a final approver.** Today `SUPER_ADMIN` covers
  president, VP and website lead (see `isSuperAdmin` in
  `src/lib/auth/roles.ts`), so the final-approver rule cannot be "is
  SUPER_ADMIN". It needs its own explicit setting, such as a list of approver
  users or an approver flag, that only a SUPER_ADMIN can change. How that
  setting is stored is left to the builder.

## Content of an issue

Matches the mockups (screens 1 to 5 in the brainstorming session).

- **Header:** "This week at FirstByte", the date, a one-line summary.
- **Coming up:** meetings from the `meetings` table in the next 2 weeks
  **(my call)**, plus collabs. Only meetings open to all members: no
  `EBOARD_MEETING` meetings and no meetings for the invite-only E-Board team
  **(my call)**. Each event links to its meeting page on the
  dashboard, where the existing "I can't make it" button already lives. No RSVP
  buttons.
  - Collabs: if a collab isn't already a meeting in the dashboard, the final
    approver can add a short line by hand on the issue page **(my call)**.
- **What the teams are up to:** one short paragraph per approved team, with an
  optional photo. Only `OPEN` teams get an update; the invite-only E-Board team
  does not **(my call)**. Today that's 5 teams: CS Curricula, STEM Curricula,
  Website, Events, Brand and Marketing.
- **Footer:** "Read more on the dashboard" link, and an unsubscribe link.

## The AI draft and its safeguards

The draft job runs once a week, once per team. Each step below exists to stop
one of the anti-goals.

1. **Collect: only what's switched on.**
   - The job reads only the Slack channels and GitHub repos that a team lead
     or officer has switched on for that team. These are the only two
     per-team sources.
   - Google Drive is not an AI source. The AI never receives images. The job
     only lists that week's meeting photos so the lead can pick one, which
     keeps photos of faces away from the AI entirely.
   - It never reads DMs or private channels.
   - It reads the past 7 days.
   - The dashboard's own data it uses: that team's meetings and attendance
     counts (totals only, never individual names).
2. **Clean: remove private details before the AI sees anything.**
   - Remove phone numbers, email addresses, and links to private documents.
   - Remove names of people who aren't members.
   - Never include anything about one person's grades or attendance.
   - This step is plain code. The builder picks how (patterns, a list of member
     names from the database, and so on).
3. **Write: Claude writes the draft, citing sources.**
   - Each line of the draft must list the IDs of the messages, pull requests or
     meetings it came from. Use structured output so this is enforced, not
     hoped for.
   - The prompt tells Claude to describe only what the sources show, in plain
     words, for a member audience.
4. **Check: drop anything without a real source.**
   - Plain code compares every cited ID with the IDs the job actually
     collected. A line that cites nothing, or cites an ID that wasn't
     collected, is dropped.
   - Lines whose only sources are Slack conversation, not finished work such as
     a merged PR or a meeting that happened, are highlighted for the lead
     to double-check.
5. **Save: keep as little as possible.**
   - Save the draft text and, for each line, links to its sources.
   - Do not save the raw Slack messages.
   - Keep a record of what the AI wrote and what people changed before it was
     sent, so the club can see how much editing the drafts need.

Then two people check it: the team lead, then the final approver.

### If the AI can't run

If the Claude API fails or the prepaid credits run out, the lead gets an empty
draft to write by hand that week. Nothing else breaks **(my call)**.

### What the AI can see page

- Visible to everyone in the club **(my call: all approved members, read-only;
  only leads and officers can change it)**.
- Lists every connected Slack channel and GitHub repo, which team it belongs
  to, who switched it on, and when. It also states that the dashboard can add
  photos to its own `FirstByte Photos` folder in the FirstByte Drive, and that the AI never sees
  photos.
- One-click "turn off" for leads and officers.

### Access is limited by the services themselves

This is the main point for the president: the limits are enforced by Slack,
GitHub and Google, not only by our code.

| Service | Setup | Limit enforced by the service |
|---|---|---|
| Slack | A Slack app with a bot, in FirstByte's workspace. Read-only scopes for channel history. | The bot can only read channels it has been invited into. Removing it from a channel cuts it off. |
| GitHub | A GitHub App with read-only permission on pull requests and contents. | Installed only on the repos the club picks. |
| Google Drive | The FirstByte Gmail account allows the dashboard in once, with Google's narrowest Drive permission (details below). | The dashboard can only see files and folders it created itself. The rest of the FirstByte Drive stays invisible to it. |
| Claude | Claude API, paid with prepaid credits. | Sees only the cleaned text for one team at a time. |

The "What the AI can see" page in the dashboard is the switch for which of the
already-allowed channels and repos each team uses. The service-level limits
above are the outer wall.

## Meeting photos

- Brand and Marketing members and officers can add photos to a meeting's page
  after it has started **(my call: from start time, so photos from during the
  meeting can be added right away)**. Members don't see the photos section
  yet **(my call)**.
- Upload flow (see architecture diagram 4):
  1. The browser removes location data from each photo.
  2. The browser asks the dashboard to upload N photos to meeting X.
  3. The dashboard finds or creates that meeting's folder in the FirstByte
     Drive, for example `FirstByte Photos / 2026-27 / Oct 20 – General
     Meeting`, and gets an upload link for each photo from Google.
  4. The browser uploads each photo straight to Google Drive with that link.
     This avoids Vercel's limit on request size.
  5. The dashboard saves only the Drive file ID for each photo.
- Photos must be added through the dashboard. Photos dropped into the folder
  directly in Drive do **not** show up, because the dashboard's narrow Drive
  permission can't see files it didn't create. That's the trade for the
  dashboard not being able to see the rest of the Drive.
- The draft job lists that week's meeting photos so the lead can pick one per
  team update.
- **Removing a photo:** Brand and Marketing members and officers can remove a
  photo from the meeting page in one click. The dashboard deletes it from
  Drive, which it can do because it created the file **(my call)**.
- **Photos stay private.** Drive files are never shared by link. Instead, at
  send time the send job downloads each chosen photo from Drive, shrinks it
  to email size (about 1200 px wide, **(my call)**), and embeds it inside the
  email itself as an inline image (Resend supports this with `content_id`
  attachments). Nothing is stored anywhere else, and no public link exists.
  - Resend's batch endpoint doesn't support attachments, so the send job sends
    one email per member. At about 60 members that's fine.
  - Once a member has the email, the photo is in their inbox like any email
    photo; forwarding it forwards the photo. That's inherent to email.
  - The member issue page on the dashboard shows the same photos through the
    dashboard, behind the login.
- **Consent:** for now, Brand and Marketing is trusted to add only photos that
  are OK to share. FirstByte's programs work with children, so a proper
  consent step (for example, a "cleared to share" checkbox per photo that only
  certain people can tick) is a **stretch feature**, not in the first
  version.

## The Google connection

FirstByte's Google account is a regular (personal) Gmail account named
FirstByte, not Google Workspace. That rules out a service account: service
accounts have no storage of their own and can't save into a personal account's
Drive, and personal accounts can't create Shared Drives.

Instead, the FirstByte account allows the dashboard in once, through Google's
normal "Sign in with Google / Allow" screen:

- Create a Google Cloud project such as `firstbyte-dashboard`, signed in as
  the FirstByte account. Add the eboard's Google Group as an owner, so access
  doesn't depend on one student.
- Turn on the Google Drive API. It's free; no billing account is needed.
- Set up the consent screen and an OAuth client. Ask only for the
  `drive.file` permission: the dashboard can see and change only files it
  created itself, plus files and folders a person explicitly picks for it in
  Google's file picker. Google classes `drive.file` as non-sensitive. The
  broader permissions (`drive`, `drive.readonly`) are "restricted": they would
  let the dashboard see the whole FirstByte Drive, and they come with Google's
  strictest review. Not used.
- **Using the club's existing shared folder.** FirstByte already shares a
  Drive folder with members. One-time setup: an officer signed in as the
  FirstByte account opens Google's picker from the dashboard and picks that
  folder. The dashboard then creates its meeting folders inside it, so
  Brand and Marketing and everyone the folder is shared with can browse the
  photos in Drive as usual. The dashboard still can't see the other files in
  that folder.
  - **Needs a 10-minute test before building on it:** Google's docs don't
    clearly say that picking a folder lets a `drive.file` app create files
    inside it. If it doesn't, the fallback is that the dashboard creates its own
    `FirstByte Photos (dashboard)` folder in the FirstByte Drive, and the
    FirstByte account shares it with the same people.
  - If the shared folder is owned by someone other than the FirstByte
    account, the FirstByte account needs edit access to it. Photos the
    dashboard uploads are owned by the FirstByte account and count against its
    15 GB either way.
- **Publish the app ("In production") rather than leaving it in "Testing".**
  In Testing, Google expires the dashboard's access every 7 days. `drive.file`
  is generally treated as a non-sensitive permission, so publishing shouldn't
  need Google's review; confirm during setup.
- An officer signed in as the FirstByte account clicks "Connect Google
  Drive" once on the dashboard. The dashboard stores the resulting refresh
  token as a server-only secret (encrypted in the database or in Vercel's
  settings; the builder decides).
- Photos count against the FirstByte account's free 15 GB, shared with its
  Gmail. That holds thousands of photos.
- Testing: a separate test Gmail account and its own OAuth client, used only
  by preview deployments.

## Email

- **Resend**, free plan **(my call)**. The free plan allows 3,000 emails a
  month and 100 a day. At about 60 members that's around 260 a month and 60 on
  send day. The club could grow to about 100 before the daily limit matters.
- Sent from an address on teachfirstbyte.com, such as
  `news@teachfirstbyte.com` **(my call)**. That needs the domain's DNS records
  set up in Resend.
- Recipients: approved members (`AccountStatus = APPROVED`) who haven't
  unsubscribed. Unsubscribing turns off the newsletter only, not account
  emails.
- Alternative considered: send through the club's Google account to a Google
  Group. Rejected because it doesn't stay in sync with the dashboard's member
  list or handle unsubscribes cleanly **(my call)**.

## AI model and cost

- Claude API through the official Anthropic TypeScript SDK
  (`@anthropic-ai/sdk`).
- Model: **Claude Opus 5.5** (`claude-opus-5-5`), the current default. Estimated
  at about $2 a month for 5 short team drafts a week. **Claude Haiku 5.5**
  (`claude-haiku-5-5`) would cost cents a year but is more likely to slip on
  "don't make things up". Switching later is a one-line change; the eboard
  decides.
- Prepaid credits in the Claude Console. Buy about $24, which covers roughly a year.
  Credits expire after a year and can't be refunded. Leave auto-reload off, so
  the club can never spend more than it put in.
- The draft job isn't urgent, so it may use the Message Batches API at half
  price. The builder decides whether the saving is worth the extra step.
- All other services (Resend, Slack, GitHub, Google Drive) are free at this
  size. Vercel and Supabase are unchanged.

## Architecture

See the architecture diagrams from the brainstorming session. In short:

- **Two new scheduled jobs** in the dashboard, set up like
  `src/app/api/cron/close-attendance/route.ts`: Vercel Cron, protected by
  `CRON_SECRET`, listed in `apps/dashboard/vercel.json`.
  - Draft job, Monday.
  - Send job, hourly from Thursday 9 AM to Sunday 11 PM. It only sends an
    Approved issue that hasn't been sent, so running it often is safe.
- **New database tables**, added through Prisma migrations: connected sources
  per team, newsletter issues, team updates with their lines and source links,
  meeting photo links, unsubscribe status, and the record of AI text vs final
  text. The exact schema is left to the builder.
- **New pages and parts**, built from the dashboard's existing components
  (`Section`, `PageHeader`, badges, buttons):
  - A Newsletter tab for leads, officers and final approvers.
  - A team lead's draft editor, with each line's sources and the photo picker.
  - An issue page with each team's status, Coming up, preview and Approve.
  - A photos section on the meeting page.
  - The "new issue" card on the member home page. It stays until the member
    opens or dismisses it, and is replaced by the next issue **(my call)**.
  - **A read-only issue page for members**, plus a simple list of past
    issues. This is where "Read it" on the home card and "Read more" in the
    email land, and opening it is what clears the card. All approved members
    can see sent issues; drafts stay hidden from members **(my call)**.
  - The "What the AI can see" page.
- **Secrets** (Slack, GitHub App, Google, Anthropic, Resend) live in Vercel
  environment variables, with separate values for Preview and Production, like
  the existing `CHECKIN_SECRET` and `CRON_SECRET`.

## Testing before connecting real accounts

Stage 1: **sample mode.** The draft job can read saved example data from files
in the repo instead of calling Slack, GitHub or Drive. The examples include
traps on purpose: a phone number, a private-sounding message, and a line with
no real source. That lets anyone test the safeguards locally and in automated
tests, without any accounts.

Stage 2: **test copies of each service**, used only by preview deployments.

| Service | Test setup |
|---|---|
| Slack | A free "FirstByte Sandbox" workspace with a test Slack app (bot scopes `channels:history`, `channels:read`). A channel the bot is invited to, plus a private channel and a DM it isn't in, to prove it can't read them. Seed messages include the trap cases. |
| GitHub | A scratch repo such as `newsletter-sandbox` with a few practice pull requests, and a test GitHub App with read-only Pull requests and Contents, installed only on that repo. |
| Google Drive | A new test Gmail account with a `FirstByte Photos (test)` folder shared to a second account, mimicking the real shared folder. Its own Google Cloud project, Drive API on, consent screen published "In production", OAuth web client with only `drive.file`. The redirect URI must match a stable preview address, such as the branch's `firstbyte-dashboard-git-<branch>-firstbyte-neu.vercel.app` URL. This is also where the folder-picker test happens. |
| Claude | A separate API key labeled "preview". |
| Email | The existing Resend account and teachfirstbyte.com domain, with a separate sending-only API key for preview. On preview, the send job only emails a short allowlist. Resend's test addresses can be used for delivered and bounced cases. |

Every key above goes in Vercel's **Preview** environment variables only.
Production gets its own app, key and account for each service at rollout.

Preview already uses its own Supabase project, and preview holds the real
officers' names and emails. So the email allowlist on preview is required, not
optional.

## First milestone: a prototype on the preview dashboard

The top priority is a working prototype on a preview deployment, to show the
president before anything reaches real accounts or members.

What's real and what's sample in the prototype **(my call)**:

| Part | In the prototype |
|---|---|
| Dashboard pages | Real: Newsletter tab, lead's draft editor, final approval page, member issue page, home page card. |
| Final approver rule | Real, using preview's test accounts. |
| GitHub | Real: read-only, from this repo's merged pull requests. The repo is public, so no GitHub App is needed yet. |
| Slack | Sample: realistic example messages from files in the repo, including the trap messages (a phone number, a private-sounding message, a claim with no source), so the president can watch the safeguards catch them. |
| Claude | Real: drafts are written by the API, with the citation check. |
| Email | Real send, but only to an allowlist (for example, you and the president). |
| Photos | Sample photos bundled with the prototype. Drive upload comes in the next step. |
| "What the AI can see" page | A simple read-only version listing the prototype's sources. |

Scheduled jobs: Vercel only runs cron jobs on the production deployment, not
on previews. So the prototype adds officer-only buttons on preview, "Run draft
job now" and "Send test issue now", that call the same code the scheduled jobs
will.

Preview shares one Supabase project across all previews, so the prototype's
migrations show up on every preview (README: "Database migrations on
preview"). Tell the team before merging migrations, and use "Reset preview
database" to go back.

What has to be set up for the prototype:

- An Anthropic Console account with a few dollars of prepaid credits and an
  API key, added to Vercel's Preview environment variables.
- Resend is already connected to teachfirstbyte.com. Make a separate
  sending-only API key for preview, and set the preview email allowlist
  (for example, the website lead's and the president's emails).
- Nothing for Slack, GitHub or Google: the prototype uses sample Slack
  messages, this public repo's pull requests, and sample photos.

## Rollout after the prototype

Suggested order **(my call)**:

1. **Newsletter core:** the draft job with all five safeguard steps, sample
   mode, team lead editing, final approval, the send job, and the home page
   card. Uses GitHub and dashboard data first.
2. **Slack** as a source.
3. **Meeting photos** and the Google Drive connection.
4. **The "What the AI can see" page.** The service-level limits and the
   safeguard steps apply from the first issue; this page is the visible
   control panel on top.

Go live with one team's channel first, then add the rest.

## Left to the builder

- Database schema and table names.
- How the final-approver setting is stored, as long as it isn't tied to
  `SUPER_ADMIN` and only a SUPER_ADMIN can change it.
- How the cleaning step detects private details.
- The exact prompt and structured-output shape for the draft.
- Whether to use the Batch API.
- Where the Google refresh token is stored.
- Email template markup.

## Stretch features

- A photo consent step for photos from programs with children.
