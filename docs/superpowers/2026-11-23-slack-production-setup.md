# Turning on Slack reminders in production

2026-11-23 · For Hector and the president

This takes the FirstByte Tasks bot from the Slack Dev Sandbox to the real FirstByte Slack, so e-board members get real reminder DMs. It takes about 30 minutes, plus however long it takes to collect everyone's Slack member ID.

The dashboard part (the Tasks board, meeting action items, the Home card) works in production without any of this. Without the bot token, reminders and the weekly summary are simply skipped.

## Before you start

- **PR #143 is merged into `main`, and the "Database migrations" run is approved.** Check that **Tasks** opens on https://teachfirstbyte.com/dashboard/tasks.
- **Your production account is a super admin and on the E-Board team.** Only super admins see **Tasks → Slack setup**.
- **Every e-board member** has an approved dashboard account and is on the E-Board team in production. People who aren't can't be linked.
- **You can install apps in the FirstByte Slack.** If the workspace only lets admins install apps, a workspace admin has to approve the request in step 1.

## 1. Create the app in the real workspace

The sandbox app stays where it is, for testing. This is a second, separate app with the same settings.

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From a manifest**.
2. Pick the **FirstByte** workspace, not the Dev Sandbox.
3. Paste `apps/dashboard/slack-tasks-app/manifest.json` and create the app.
4. **Install App** → **Install to FirstByte** → **Allow**. Slack should ask for only two permissions: sending messages as the app, and starting direct messages. If you see **Request to Install**, a workspace admin has to approve it first.
5. **App Home** → **Show Tabs**: **Messages Tab** on, **Allow users to send … messages** off. The manifest sets this already. If the box is checked, uncheck it and save.
6. Optional: **Basic Information** → **Display Information** → add the logo, once one is picked.

## 2. Give production the token

1. **OAuth & Permissions** → copy the **Bot User OAuth Token** (`xoxb-…`). Don't paste it anywhere but Vercel.
2. Vercel → **firstbyte-dashboard** → **Settings** → **Environment Variables** → add `TASKS_SLACK_BOT_TOKEN`, ticking **Production** only. Previews keep the sandbox token.
3. In the same list, check that **Production** has:
   - `CRON_SECRET`: the attendance job uses it already, so it should be there.
   - `NEXT_PUBLIC_APP_URL` = `https://teachfirstbyte.com`: the "Open your tasks" links in DMs use it.
4. **Deployments** → the latest **Production** deployment → **⋯** → **Redeploy**. New variables only reach a new deployment.

After the redeploy, **Tasks → Slack setup** no longer shows the "bot token isn't set" warning.

## 3. Link everyone

1. Collect each e-board member's **Slack member ID**. In Slack: open their profile → **⋮** → **Copy member ID**. It looks like `U07ABC1234`. People can also send you their own.
2. Open https://teachfirstbyte.com/dashboard/tasks/slack.
3. **Link yourself first.** Paste your ID → **Save**. You should get the bot's welcome DM within a minute, under **Apps → FirstByte Tasks**. If it doesn't come, stop here and check the token and the redeploy.
4. Link everyone else. Each person gets the welcome DM when they're linked. It tells them what the bot will send them and links to their tasks.
5. Anyone you skip shows "Not connected to Slack" on the board and gets no reminders.

## 4. Set the weekly summary

On the same page, under **Weekly summary**, pick the day and time (Boston). Monday 9am is the default. The president, VP and website lead get it, if they're linked.

## 5. Check it works

1. Create a task for yourself due **tomorrow**. You get an "assigned" DM right away.
2. The next morning at 9am Boston time, you get "due today".
3. Mark it **Done**. No more reminders come for it.

## 6. Tell the e-board

Post this yourself in the e-board channel. The bot never posts in channels:

> Hey e-board! 👋 Action items from our meetings now live on the dashboard: **Tasks** in the nav (https://teachfirstbyte.com/dashboard/tasks). You'll see your own tasks first; turn off "Only mine" to see everyone's.
>
> The **FirstByte Tasks** bot will DM you when a task is assigned to you, 2 days before it's due, on the due date, and if it's overdue. You can't reply to it. Update your tasks on the dashboard and the reminders stop once a task is Done. If you didn't get a welcome DM from it, send me your Slack member ID (profile → ⋮ → Copy member ID).

## Turning it off

- **Everyone:** delete `TASKS_SLACK_BOT_TOKEN` from Vercel's Production variables and redeploy. Every reminder and summary is then skipped, not failed, and the board keeps working.
- **One person:** **Unlink** them on Slack setup.
- **Uninstalling the app** in Slack also stops everything. The board then marks sends as "Reminder not delivered".

## Good to know

- Reminders come from an hourly job that runs **on production only**. Nothing is sent from previews unless someone runs the job by hand.
- Member IDs are different in every workspace. The sandbox IDs (Maya, Daniel, Jordan…) mean nothing in the real workspace, and those fake people don't exist in production.
- The free Slack plan allows up to 10 installed apps. If the workspace is at the limit, an app has to be removed first.
