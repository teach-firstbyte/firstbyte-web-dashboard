/**
 * The weekly task summary (#139): when it goes out, what it says, and its
 * Slack text. A DM to every super admin (the president, VP and website lead)
 * who is linked to Slack, once a week, at a day and hour a super admin picks
 * on Slack setup. Monday 9am Boston time unless someone changes it.
 *
 * Pure functions: no clock, no database, no Slack. The caller passes `now`.
 * server/tasks/weekly-summary.ts records and sends what these decide, and
 * weekly-summary.test.ts covers them.
 *
 * Imports only other import-free lib files, so `node --test` loads it as it is.
 *
 * Every day and hour is Boston time, whatever the server's own zone. The
 * schedule is worked out on Boston's wall clock (the day and the hour), never
 * by adding hours to an instant, so daylight saving can't move it: an hour
 * that doesn't exist (2am on the spring-forward Sunday) goes out with the
 * first run after it, and one that happens twice (1am in November) goes out
 * with the first and is refused the second time by the "once a week" key.
 */

import { addDays, bostonClock } from "./reminders.ts";
import {
  bold,
  escapeSlackText,
  formatDueDate,
  link,
  type SlackMessage,
} from "./slack-messages.ts";

// ---------------------------------------------------------------------------
// The schedule

/**
 * When the summary goes out: a weekday (0 Sunday to 6 Saturday, as
 * Date.getDay counts) and an hour (0 to 23), both Boston time. The club has
 * one, in the task_settings table.
 */
export type SummarySchedule = { day: number; hour: number };

/** The spec's default: Mondays at 9am. */
export const DEFAULT_SUMMARY_SCHEDULE: SummarySchedule = { day: 1, hour: 9 };

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/**
 * A run that missed the hour still sends the summary, for this long after
 * it: until the same hour the next day. Any later and it's dropped, rather
 * than landing days late or right after someone moved the setting.
 */
export const SUMMARY_LATE_HOURS = 24;

/** A whole number from 0 to 6 and one from 0 to 23. */
export function isSummarySchedule(value: {
  day: unknown;
  hour: unknown;
}): value is SummarySchedule {
  return (
    Number.isInteger(value.day) &&
    (value.day as number) >= 0 &&
    (value.day as number) <= 6 &&
    Number.isInteger(value.hour) &&
    (value.hour as number) >= 0 &&
    (value.hour as number) <= 23
  );
}

/** 0 (Sunday) to 6 (Saturday) for a "YYYY-MM-DD" day. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * The Monday that starts the week a day is in, Monday to Sunday. It's the
 * summary's "once a week" key: one row per recipient per week, so a run that
 * comes late, twice or at the same time as another can't send a second one,
 * and neither can moving the day to later in a week that already had one.
 */
export function weekOf(date: string): string {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

/** A summary's slot: the Boston day and hour it's for, and its week. */
export type SummarySlot = { date: string; hour: number; weekOf: string };

function slot(date: string, hour: number): SummarySlot {
  return { date, hour, weekOf: weekOf(date) };
}

/**
 * The summary that should go out by `now`, or null if none should.
 *
 * Due from the configured hour on the configured day until the same hour the
 * next day (SUMMARY_LATE_HOURS), so a run that comes late, or an hour with no
 * run at all, still sends it. Whether it already went out this week is the
 * database's question: the caller records it under its week and the unique
 * key refuses a second copy.
 */
export function summaryDueNow(
  schedule: SummarySchedule,
  now: Date,
): SummarySlot | null {
  const { date: today, hour } = bostonClock(now);
  if (weekdayOf(today) === schedule.day && hour >= schedule.hour) {
    return slot(today, schedule.hour);
  }
  const yesterday = addDays(today, -1);
  if (weekdayOf(yesterday) === schedule.day && hour < schedule.hour) {
    return slot(yesterday, schedule.hour);
  }
  return null;
}

/**
 * When the next summary goes out, for the Slack setup page.
 *
 * `lastWeekOf` is the week of the latest summary recorded for anyone (null if
 * there's never been one). A slot in that week is skipped, since that week
 * has had its summary.
 *
 * `now: true` means one is due and hasn't been recorded: it goes out with the
 * next hourly run, not at `date` and `hour`.
 */
export function nextSummary(
  schedule: SummarySchedule,
  now: Date,
  lastWeekOf: string | null,
): SummarySlot & { now: boolean } {
  const due = summaryDueNow(schedule, now);
  if (due && due.weekOf !== lastWeekOf) return { ...due, now: true };

  const { date: today, hour } = bostonClock(now);
  for (let i = 0; i <= 14; i++) {
    const date = addDays(today, i);
    if (weekdayOf(date) !== schedule.day) continue;
    if (i === 0 && schedule.hour <= hour) continue;
    const next = slot(date, schedule.hour);
    if (next.weekOf === lastWeekOf) continue;
    return { ...next, now: false };
  }
  // Unreachable: two weeks always hold a slot in a week other than one.
  throw new Error("No summary slot in the next two weeks");
}

/** "9:00 AM", "12:00 PM". */
export function hourLabel(hour: number): string {
  return `${((hour + 11) % 12) + 1}:00 ${hour < 12 ? "AM" : "PM"}`;
}

/** "Mondays at 9:00 AM", for the setup page. */
export function scheduleLabel(schedule: SummarySchedule): string {
  return `${WEEKDAY_NAMES[schedule.day]}s at ${hourLabel(schedule.hour)}`;
}

/**
 * "Next: Mon, Nov 30 at 9:00 AM.", or, when one is due and not sent yet,
 * "This week's goes out with the next hourly run."
 */
export function nextSummaryLabel(next: SummarySlot & { now: boolean }): string {
  return next.now
    ? "This week's goes out with the next hourly run."
    : `Next: ${formatDueDate(next.date)} at ${hourLabel(next.hour)}.`;
}

/** "Maya", "Maya and Daniel", "Maya, Daniel and Sam". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// ---------------------------------------------------------------------------
// What it says

/** "Due this week" is today and the 6 days after it: the next 7 days. */
export const SUMMARY_DAYS_AHEAD = 7;

/** An open task, as the summary reads it. */
export type SummaryTask = {
  id: number;
  title: string;
  status: string;
  /** "YYYY-MM-DD" */
  dueDate: string;
  ownerId: number;
  /** The owner's full name (or "Former member" for a deleted account). */
  ownerName: string;
  /** The owner left the e-board or deleted their account. */
  needsNewOwner: boolean;
};

/** Someone on the e-board now. */
export type SummaryPerson = {
  id: number;
  name: string;
  slackConnected: boolean;
};

export type SummaryLine = { id: number; title: string; due: string };

export type WeeklySummary = {
  /** The Boston day it was built, "YYYY-MM-DD". */
  date: string;
  counts: { overdue: number; dueThisWeek: number; open: number };
  /** Overdue or due in the next 7 days, by owner. Owners by name. */
  people: { ownerId: number; name: string; tasks: SummaryLine[] }[];
  /** Every open task whose owner left, soonest due first. */
  needsNewOwner: (SummaryLine & { formerOwner: string })[];
  /** E-board members with no Slack link, by name. */
  notConnected: string[];
};

const DONE = "DONE";
const DAY_MS = 86_400_000;

function daysFrom(today: string, date: string): number {
  const utc = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((utc(date) - utc(today)) / DAY_MS);
}

/**
 * "3 days overdue", "due today", "due tomorrow", "due Fri" (this week),
 * "due Fri, Dec 4" (later). The board's wording, lower case for a list.
 */
export function summaryDueWording(dueDate: string, today: string): string {
  const n = daysFrom(today, dueDate);
  if (n < 0) return `${-n} ${n === -1 ? "day" : "days"} overdue`;
  if (n === 0) return "due today";
  if (n === 1) return "due tomorrow";
  if (n < SUMMARY_DAYS_AHEAD)
    return `due ${formatDueDate(dueDate).split(",")[0]}`;
  return `due ${formatDueDate(dueDate)}`;
}

const byName = (a: string, b: string) =>
  a.localeCompare(b, "en", { sensitivity: "base" });

const byDue = (a: SummaryTask, b: SummaryTask) =>
  a.dueDate.localeCompare(b.dueDate) || byName(a.title, b.title) || a.id - b.id;

/**
 * The summary's content, from the board as it is: every task that isn't Done
 * and everyone on the e-board now. `today` is the Boston day.
 *
 * - Overdue or due in the next 7 days, grouped by owner. A task whose owner
 *   left isn't under them: it's in "Needs a new owner", whatever its date.
 * - The counts include every open task, those that need a new owner too.
 */
export function buildWeeklySummary(input: {
  tasks: SummaryTask[];
  eboard: SummaryPerson[];
  today: string;
}): WeeklySummary {
  const { today } = input;
  const open = input.tasks.filter((t) => t.status !== DONE).sort(byDue);
  const days = (t: SummaryTask) => daysFrom(today, t.dueDate);
  const line = (t: SummaryTask): SummaryLine => ({
    id: t.id,
    title: t.title,
    due: summaryDueWording(t.dueDate, today),
  });

  const byOwner = new Map<number, { name: string; tasks: SummaryLine[] }>();
  for (const t of open) {
    if (t.needsNewOwner || days(t) >= SUMMARY_DAYS_AHEAD) continue;
    const group = byOwner.get(t.ownerId) ?? { name: t.ownerName, tasks: [] };
    group.tasks.push(line(t));
    byOwner.set(t.ownerId, group);
  }

  return {
    date: today,
    counts: {
      overdue: open.filter((t) => days(t) < 0).length,
      dueThisWeek: open.filter(
        (t) => days(t) >= 0 && days(t) < SUMMARY_DAYS_AHEAD,
      ).length,
      open: open.length,
    },
    people: [...byOwner.entries()]
      .map(([ownerId, g]) => ({ ownerId, ...g }))
      .sort((a, b) => byName(a.name, b.name) || a.ownerId - b.ownerId),
    needsNewOwner: open
      .filter((t) => t.needsNewOwner)
      .map((t) => ({ ...line(t), formerOwner: t.ownerName })),
    notConnected: input.eboard
      .filter((p) => !p.slackConnected)
      .map((p) => p.name)
      .sort(byName),
  };
}

/**
 * The DM, laid out like the mockup's "Weekly summary" on its Slack DMs
 * screen. Slack mrkdwn: everything a person typed is escaped.
 */
export function weeklySummaryMessage(
  summary: WeeklySummary,
  url: string,
): SlackMessage {
  const { counts } = summary;
  const parts: string[] = [
    `*Weekly task summary · ${formatDueDate(summary.date)}*`,
    `${counts.overdue} overdue · ${counts.dueThisWeek} due this week · ${counts.open} open`,
    "",
  ];

  const titleAndDue = (t: SummaryLine) =>
    `${escapeSlackText(t.title)} (${t.due})`;

  if (summary.people.length > 0) {
    parts.push("*Overdue or due this week*");
    for (const p of summary.people) {
      parts.push(`• ${bold(p.name)}: ${p.tasks.map(titleAndDue).join("; ")}`);
    }
  } else {
    parts.push("Nothing is overdue or due this week.");
  }

  if (summary.needsNewOwner.length > 0) {
    parts.push("", "*Needs a new owner*");
    for (const t of summary.needsNewOwner) {
      parts.push(
        `• ${escapeSlackText(t.title)} (was ${escapeSlackText(t.formerOwner)}'s, ${t.due})`,
      );
    }
  }

  if (summary.notConnected.length > 0) {
    parts.push("", "*Not connected to Slack*");
    for (const name of summary.notConnected) {
      parts.push(
        `• ${escapeSlackText(name)} won't get reminders until Hector links their account.`,
      );
    }
  }

  parts.push("", link(url));
  return { text: parts.join("\n") };
}
