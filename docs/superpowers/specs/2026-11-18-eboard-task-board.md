# E-board Task Board — Feature Spec

2026-11-18 · Requested by the president · Spec by Hector

## Problem

E-board action items are written in the agenda Google Doc during meetings, and sometimes come up again in Slack. Nothing tracks them after that. There is no single place to see who owes what, whether it's started or done, and nobody gets a nudge before a deadline. The president feels this most, because finding out where things stand means asking each person. E-board members lose track of what they agreed to as well.

## Users

- **The president, VP and website lead** (`SUPER_ADMIN`). They create tasks, see everything, and get a weekly summary.
- **E-board members**, which includes every team lead. They own tasks, update their status and can create tasks too.
- **How often:** Tasks are added live during each e-board meeting while the president screenshares. The e-board opens the dashboard about once a week. Slack reminders fill in between visits.
- **Not users yet:** General club members. They don't see Tasks at all.

## Goals

1. Get action items out of the meeting and into a tracked task, while the meeting is happening, as quickly as typing a line in the doc.
2. Let the president see at a glance what each person and each team owes, and what's overdue.
3. Remind owners in Slack before things are due, so nobody has to chase anyone.

## Requirements

**A task** has a title, one owner (an e-board member), a due date (a date only, required) and a status: To do, In progress or Done. It can also have a team label, a link to the e-board meeting it came from, and notes. "Overdue" isn't a status. The board shows it automatically when the due date has passed and the task isn't Done.

**Adding tasks**
- Each e-board meeting's page in the dashboard has an **Action items** section. Each row is a title, owner and due date. Enter saves the row and starts the next one, with no page reload. Typing an owner's name fills it in, and due dates can be typed as "fri" or "next week." Text is large enough to read on a shared screen. Every row becomes a task linked to that meeting.
- A **New task** form on the board, for anything that didn't come from a meeting.
- The president or Hector creates each e-board meeting in the dashboard before it starts.
- Only action items move into the dashboard. The agenda and discussion notes stay in the Google Doc.

**The board**
- A **Tasks** link in the nav, shown only to e-board members and `SUPER_ADMIN`s.
- The board has two views, switched with **Board | List** and kept in the link (`?view=list`). Board is the default (#144, mockup: `2026-11-19-tasks-kanban-mockup.html`).
  - **Board**: To do, In progress and Done columns. Each card shows the title, the owner, the due date and the team, plus "Needs a new owner" and "Reminder not delivered". Overdue cards stand out, and each open column is sorted soonest due first. Done shows the 5 most recently finished (by last change), with "Show all" for the rest. Filters: a person (or "Needs a new owner"), a team (or "No team"), and "Only mine". "Only mine" starts on for regular e-board members and off for super admins, in both views. Anyone can turn it off, and picking a person or a team turns it off too. The URL says `mine=1` or `mine=0` only when it differs from that person's default.
  - Status changes by dragging a card to another column (the browser's own drag and drop), or with the status menu on each card, which works with the keyboard and on phones. Both follow the rules below and go through `PATCH /api/tasks/[id]`. Cards the viewer can't change show a lock and won't drag. On narrow screens the board shows one column at a time, picked with tabs, and has no dragging.
  - **List**: tasks grouped by owner, with overdue first and then by due date. You can switch to grouping by team. There's a "Mine" filter, and Done tasks are hidden unless "Show done" is on.
- A **My tasks** card on each e-board member's Home page shows what's overdue and what's due this week.

**Who can do what**
- Every e-board member and `SUPER_ADMIN` can see every task.
- An owner can change their own task's status.
- Only the task's creator or a `SUPER_ADMIN` can change the title, owner or due date, or delete the task.
- Anyone else is redirected to Home, and the API refuses them too.

**Slack reminders.** These are direct messages from a separate "FirstByte Tasks" bot. It isn't the newsletter bot.

| When | Who gets the DM |
|---|---|
| Task assigned (or reassigned) | The new owner. On reassignment, the previous owner is told the task is no longer theirs. |
| Due date changed | The owner, with the old and new dates and who changed it |
| 2 days before due | The owner |
| Due date, 9am ET | The owner |
| 1 day overdue | The owner and the creator |
| Weekly summary (Monday 9am ET by default) | All three `SUPER_ADMIN`s: overdue tasks, what's due this week, and tasks that need a new owner, grouped by person |

- A `SUPER_ADMIN` can change the summary's day and time. There is one setting for the whole club.
- Hector links each e-board member to their Slack account by hand, in a small Slack setup list that only `SUPER_ADMIN`s can see. Nothing is matched automatically. Until someone is linked, the board shows "⚠ Not connected to Slack" next to them, and the weekly summary lists them. There is no email fallback.
- Reminders stop once a task is Done. No message is ever sent twice. Changing a due date starts that task's reminders over from the new date.
- A task created already overdue or due today gets only the "assigned" message.
- All dates and times are in Boston time (Eastern).
- For now the bot runs in the FirstByte Slack sandbox. The president and Hector approve installing it in the real workspace.

**Edge cases**
- **The owner leaves the e-board or deletes their account.** Their open tasks are marked "Needs a new owner" and move to the top of the board. Reminders for them stop, and they appear in the weekly summary. Nothing is deleted on its own.
- **The linked meeting is deleted.** The task stays, and the link to the meeting is removed.
- **A DM fails** (Slack is down or the bot is broken). It's retried every hour for up to a day. If it still fails, the task shows "⚠ Reminder not delivered."
- **Empty states.** The board says "No open tasks. Add one from an e-board meeting or with New task." The Home card says "Nothing due. You're clear."

**Prototype first.** Before building anything real, make a clickable mockup with fake data. It shows the board, the Home card, the meeting page's Action items rows with working fast entry, and sample Slack messages. It isn't connected to the database, Slack or the dashboard code.

**Kept apart from the newsletter.** The task board shares no code, bot or branch with the newsletter, which is on hold. This work is on the `feat/eboard-task-board` branch, made from `main`. `main` has no newsletter or Slack code, so the Tasks bot and its Slack connection are built from scratch.

## Out of scope

- Moving the agenda into the dashboard. This is the likely next version, then the whole doc.
- AI import of action items from the Google Doc.
- Access for general club members. Tasks are for the e-board only.
- Matching people to Slack accounts automatically, by email or any other way.
- Tasks owned by a whole team, or by someone outside the e-board.
- Subtasks, priorities, a "Blocked" status, comments, attachments.
- Reordering cards by hand within a column, columns beyond To do, In progress and Done, and dragging on phones.
- Each person choosing their own reminder timing, or daily overdue reminders.
- Email reminders, or Slack channel posts.
- Owners asking for a new due date (for now they ask the creator).
- Any change to the newsletter or its Slack bot.

## Acceptance criteria

1. **Prototype gate:** The president uses the mockup in one real e-board meeting and adds at least 5 action items without going back to the doc. Building starts only after that.
2. During a meeting, an e-board member adds a task (title, owner, due date) from the meeting's page using only the keyboard, in about 15 seconds or less. It shows on the board linked to that meeting.
3. The board groups by owner, puts overdue first and then sorts by due date, switches to grouping by team, filters to "Mine," and hides Done tasks unless "Show done" is on.
4. An owner can change status but not the owner or due date. The creator and `SUPER_ADMIN`s can change everything and delete. A non-e-board user can't open Tasks or reach it through the API.
5. Each e-board member's Home card shows their overdue tasks and the ones due this week.
6. In the Slack sandbox, every DM in the reminders table arrives at the right time, to the right people, exactly once. Reminders stop once the task is Done.
7. A `SUPER_ADMIN` changes the summary's day and time, and the next summary follows the new setting.
8. Someone who isn't linked shows the "not connected" warning. Once Hector links their Slack account, their next reminder arrives. A failed send is retried hourly for a day and then shows "reminder not delivered."
9. Taking someone off the EBOARD team marks their open tasks "Needs a new owner," and those tasks appear in the weekly summary.
10. No newsletter code or newsletter bot is changed.

## Open questions

- When should the bot move from the sandbox to the real FirstByte Slack? Hector will decide. When it does, every e-board member's Slack link has to be set up again for the real workspace.
