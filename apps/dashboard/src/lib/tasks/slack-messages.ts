// The DM texts the FirstByte Tasks bot sends, matching the "Slack DMs" screen
// of docs/superpowers/specs/2026-11-18-eboard-task-board-mockup.html.
//
// Pure functions: no clock, no env, no database. The caller (reminder
// scheduling, #138) decides when each one goes out, looks up the names and
// builds the dashboard link, then hands the result to sendSlackDm().
//
// Dates are date-only. Pass "YYYY-MM-DD" or the Date Prisma returns for a
// @db.Date column (UTC midnight). Either way they're printed as that calendar
// day, never shifted by a time zone.
//
// The weekly summary (#139) is in weekly-summary.ts, with the rules that
// build it. It uses bold() and link() from here.

/** What sendSlackDm() posts. `text` is Slack mrkdwn. */
export type SlackMessage = { text: string };

export type DateOnly = string | Date;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUtcDate(value: DateOnly): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new RangeError("Invalid date");
    return value;
  }
  const m = DATE_ONLY.exec(value);
  if (!m) throw new RangeError(`Expected a YYYY-MM-DD date, got "${value}"`);
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (date.getUTCDate() !== Number(m[3])) {
    throw new RangeError(`Not a real date: "${value}"`);
  }
  return date;
}

/** "Fri, Nov 20", like the board. */
export function formatDueDate(value: DateOnly): string {
  return toUtcDate(value).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "Nov 20", for the meeting a task came from. */
export function formatShortDate(value: DateOnly): string {
  return toUtcDate(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Slack treats &, < and > as control characters in message text. Anything a
 * person typed (titles, names, team labels) goes through this first, so a
 * title like "<!channel>" can't ping anyone.
 */
export function escapeSlackText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** *Bold*, escaped. */
export function bold(value: string): string {
  return `*${escapeSlackText(value)}*`;
}

/** <url|Open in dashboard>, with the URL made safe for Slack's link syntax. */
export function link(url: string, label = "Open in dashboard"): string {
  const safeUrl = url
    .replace(/\|/g, "%7C")
    .replace(/</g, "%3C")
    .replace(/>/g, "%3E");
  return `<${safeUrl}|${label}>`;
}

function lines(...parts: (string | null | undefined | false)[]): SlackMessage {
  return { text: parts.filter(Boolean).join("\n") };
}

/**
 * To the new owner when a task is created for them or reassigned to them.
 * `assignedByName` is the first name of whoever did it, or null when the owner
 * made the task themselves.
 */
export function taskAssignedMessage(input: {
  title: string;
  dueDate: DateOnly;
  assignedByName: string | null;
  team?: string | null;
  meetingDate?: DateOnly | null;
  url: string;
}): SlackMessage {
  const lead = input.assignedByName
    ? `${escapeSlackText(input.assignedByName)} assigned you a task: ${bold(input.title)}`
    : `You have a new task: ${bold(input.title)}`;
  const details = [
    `Due ${formatDueDate(input.dueDate)}`,
    input.team ? escapeSlackText(input.team) : null,
    input.meetingDate
      ? `From the e-board meeting on ${formatShortDate(input.meetingDate)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return lines(lead, details, link(input.url));
}

/** To the owner, 2 days before the due date. */
export function taskDueSoonMessage(input: {
  title: string;
  dueDate: DateOnly;
  statusLabel: string;
  url: string;
}): SlackMessage {
  return lines(
    `${bold(input.title)} is due in 2 days, on ${formatDueDate(input.dueDate)}.`,
    `Status: ${escapeSlackText(input.statusLabel)}`,
    link(input.url),
  );
}

/** To the owner on the due date, 9am Eastern. */
export function taskDueTodayMessage(input: {
  title: string;
  statusLabel: string;
  url: string;
}): SlackMessage {
  return lines(
    `${bold(input.title)} is due today.`,
    `Status: ${escapeSlackText(input.statusLabel)}. Mark it done in the dashboard and the reminders stop.`,
    link(input.url),
  );
}

/**
 * To the owner, 1 day overdue. `creatorName` is the creator's first name, or
 * null when the owner made the task (they can change the date themselves).
 */
export function taskOverdueOwnerMessage(input: {
  title: string;
  dueDate: DateOnly;
  creatorName: string | null;
  url: string;
}): SlackMessage {
  const next = input.creatorName
    ? `Update the status, or ask ${escapeSlackText(input.creatorName)} for a new date.`
    : "Update the status, or change the due date.";
  return lines(
    `${bold(input.title)} was due yesterday, ${formatDueDate(input.dueDate)}.`,
    next,
    link(input.url),
  );
}

/**
 * To the creator, 1 day overdue, when they aren't the owner. `ownerName` is
 * the owner's full name.
 */
export function taskOverdueCreatorMessage(input: {
  title: string;
  ownerName: string;
  url: string;
}): SlackMessage {
  return lines(
    `Heads up: ${bold(input.title)}, owned by ${escapeSlackText(input.ownerName)}, was due yesterday.`,
    link(input.url),
  );
}

/** To the owner when someone moves the due date. */
export function taskDueDateChangedMessage(input: {
  title: string;
  oldDueDate: DateOnly;
  newDueDate: DateOnly;
  changedByName: string;
  url: string;
}): SlackMessage {
  return lines(
    `${escapeSlackText(input.changedByName)} moved the due date for ${bold(input.title)} from ${formatDueDate(input.oldDueDate)} to ${formatDueDate(input.newDueDate)}.`,
    link(input.url),
  );
}

/**
 * To the previous owner when a task is reassigned. No link: it isn't theirs
 * any more. `newOwnerName` is a full name, `reassignedByName` a first name.
 */
export function taskReassignedAwayMessage(input: {
  title: string;
  newOwnerName: string;
  reassignedByName: string;
}): SlackMessage {
  return lines(
    `${bold(input.title)} was reassigned to ${escapeSlackText(input.newOwnerName)} by ${escapeSlackText(input.reassignedByName)}. It's off your list.`,
  );
}
