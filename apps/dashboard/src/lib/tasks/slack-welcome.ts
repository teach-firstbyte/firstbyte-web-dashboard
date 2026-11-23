// The hello DM the FirstByte Tasks bot sends someone when a super admin links
// them to Slack, and what the Slack setup page says about it.
//
// Pure functions, like slack-messages.ts: no clock, no env, no database.
// server/tasks/slack-welcome.ts looks up the person and the weekly summary's
// setting and sends it; the PUT /api/tasks/slack/<userId> route decides
// whether to (welcomeDmFor). slack-welcome.test.ts covers them.
//
// Imports only other import-free lib files, so `node --test` loads it as it is
// and the setup page's client bundle gets no server code.

import { escapeSlackText, link, type SlackMessage } from "./slack-messages.ts";

/**
 * What happens about the welcome DM when someone is linked:
 * - sending: they're newly linked, or their member ID changed (a new
 *   workspace), so it goes out right after the response.
 * - no_bot_token: it would, but TASKS_SLACK_BOT_TOKEN isn't set, so nothing
 *   goes out.
 * - not_needed: the same ID was saved again. They had theirs already.
 */
export type WelcomeDm = "sending" | "no_bot_token" | "not_needed";

export function welcomeDmFor(input: {
  /** Their member ID before this save, or null if they weren't linked. */
  before: string | null;
  after: string | null;
  botConfigured: boolean;
}): WelcomeDm {
  if (input.before === input.after) return "not_needed";
  return input.botConfigured ? "sending" : "no_bot_token";
}

/** "Priya": the preferred name, else the first word of the name, else null. */
export function greetingName(p: {
  name: string | null;
  preferredName: string | null;
}): string | null {
  return p.preferredName?.trim() || p.name?.trim().split(/\s+/)[0] || null;
}

/**
 * The welcome DM. `firstName` is from greetingName. `weeklySummary` is when
 * the weekly summary goes out ("Mondays at 9:00 AM", from scheduleLabel) for
 * a super admin, who gets it, and null for everyone else.
 */
export function welcomeMessage(input: {
  firstName: string | null;
  weeklySummary: string | null;
  url: string;
}): SlackMessage {
  const hi = input.firstName
    ? `Hi ${escapeSlackText(input.firstName)}!`
    : "Hi!";
  return {
    text: [
      `${hi} I'm FirstByte Tasks, the e-board's task reminder bot.`,
      "I'll DM you when a task is assigned to you or its due date changes, 2 days before it's due, on the due date at 9am, and if it's overdue.",
      input.weeklySummary
        ? `You'll also get the weekly summary, ${escapeSlackText(input.weeklySummary)}: what's overdue or due in the next 7 days, by person.`
        : null,
      `See and update your tasks in the dashboard: ${link(input.url, "Open your tasks")}`,
      "You can't reply here. If anything looks wrong, ask the president.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/** The setup page's line under "Linked Priya Shah". `name` is a full name. */
export function linkedDescription(name: string, welcome: WelcomeDm): string {
  const first = name.trim().split(/\s+/)[0] || name;
  switch (welcome) {
    case "sending":
      return `A welcome DM is on its way to ${first}, and reminders start with the next one.`;
    case "no_bot_token":
      return `No welcome DM went out, because the bot token (TASKS_SLACK_BOT_TOKEN) isn't set here. ${first} gets reminders once it is.`;
    case "not_needed":
      return `That's the member ID ${first} already had, so no welcome DM this time.`;
  }
}
