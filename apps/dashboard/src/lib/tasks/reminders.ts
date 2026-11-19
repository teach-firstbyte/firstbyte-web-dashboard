/**
 * Which Slack reminders a task gets, and when. The rules of the spec's
 * reminders table, as pure functions: no clock, no database, no Slack. The
 * caller passes `now`. server/tasks/reminders.ts records and sends what these
 * decide, and reminders.test.ts covers them.
 *
 * Imports nothing but lib/format.ts (itself import-free), so `node --test`
 * loads it as it is.
 *
 * Dates are "YYYY-MM-DD" days with no time, as TaskView sends dueDate. Every
 * "today" and "9am" is Boston time (America/New_York), whatever the server's
 * own zone, and daylight saving is the time zone database's job, not ours.
 */

import { CLUB_TIME_ZONE } from "../format.ts";

/** Scheduled reminders go out from this hour, Boston time. */
export const REMINDER_HOUR = 9;

/** A failed send is tried again for this long after its first try. */
export const RETRY_FOR_MS = 24 * 60 * 60 * 1000;

/**
 * The gap before the next try. A little under an hour, so the next hourly run
 * picks it up even if that run starts a few seconds earlier in its minute.
 */
export const RETRY_AFTER_MS = 50 * 60 * 1000;

/**
 * A row a sender took but never finished (the function was killed mid-send)
 * is given up on after this long. It isn't retried: Slack may already have
 * delivered it, and a missed DM beats a doubled one.
 */
export const STUCK_AFTER_MS = 15 * 60 * 1000;

/** The same names as the TaskReminderKind enum in the Prisma schema. */
export type EventReminderKind =
  "ASSIGNED" | "DUE_DATE_CHANGED" | "REASSIGNED_AWAY";
export type ScheduledReminderKind =
  "DUE_SOON" | "DUE_TODAY" | "OVERDUE_OWNER" | "OVERDUE_CREATOR";
export type ReminderKind = EventReminderKind | ScheduledReminderKind;

const DONE = "DONE";

// ---------------------------------------------------------------------------
// Boston time

const bostonParts = new Intl.DateTimeFormat("en-US", {
  timeZone: CLUB_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

/** The Boston calendar day and hour (0-23) of an instant. */
export function bostonClock(instant: Date): { date: string; hour: number } {
  const parts: Record<string, string> = {};
  for (const p of bostonParts.formatToParts(instant)) parts[p.type] = p.value;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
  };
}

/** "2026-11-20" plus n days. Calendar arithmetic, so DST can't shift it. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Scheduled reminders (the hourly job)

/** The facts about a task the schedule depends on. */
export type ReminderTask = {
  status: string;
  /** "YYYY-MM-DD" */
  dueDate: string;
  ownerId: number;
  createdById: number;
  /** The owner left the e-board or deleted their account. */
  needsNewOwner: boolean;
  /**
   * When the current owner and due date were set (Task.remindersFrom). Only a
   * reminder whose day is after this day counts.
   */
  remindersFrom: Date;
};

export type PlannedReminder = {
  kind: ScheduledReminderKind;
  recipientId: number;
  /** The due date it's about: part of its "send once" key. */
  dueDate: string;
};

/**
 * The scheduled reminders a task should have had by `now`. The hourly job
 * records each one (once: the database refuses a second copy) and sends it.
 *
 * - 2 days before the due date, on the due date, and 1 day after it, each from
 *   9am Boston time, to the owner. The overdue one also goes to the creator,
 *   if they aren't the owner.
 * - Only on that day itself. If no run happened that day (Vercel was down),
 *   the reminder is dropped, rather than sent late with a date that's wrong.
 * - Only for a day after the day the schedule started (remindersFrom), so a
 *   task never gets a pile of reminders whose time has passed. And a task
 *   created, reassigned or moved to a date that's today or already past gets
 *   the event DM and nothing else, not even the overdue one.
 * - Nothing for a Done task, or one that needs a new owner.
 */
export function scheduledRemindersDue(
  task: ReminderTask,
  now: Date,
): PlannedReminder[] {
  if (task.status === DONE || task.needsNewOwner) return [];

  const clock = bostonClock(now);
  if (clock.hour < REMINDER_HOUR) return [];

  const startedOn = bostonClock(task.remindersFrom).date;
  const today = clock.date;
  const due = task.dueDate;
  // Created (or handed over, or moved) on or after the due date: the event DM
  // was the whole of it. The spec: "only the assigned message".
  if (due <= startedOn) return [];
  if (today <= startedOn) return [];

  const owner = (kind: ScheduledReminderKind): PlannedReminder => ({
    kind,
    recipientId: task.ownerId,
    dueDate: due,
  });

  if (today === addDays(due, -2)) return [owner("DUE_SOON")];
  if (today === due) return [owner("DUE_TODAY")];
  if (today === addDays(due, 1)) {
    const planned = [owner("OVERDUE_OWNER")];
    if (task.createdById !== task.ownerId) {
      planned.push({
        kind: "OVERDUE_CREATOR",
        recipientId: task.createdById,
        dueDate: due,
      });
    }
    return planned;
  }
  return [];
}

/**
 * The due dates the hourly job has to look at on a given Boston day: a task
 * can only have a reminder today if it's due today, tomorrow, the day after
 * (the 2-day one), or was due yesterday (the overdue one).
 */
export function dueDateWindow(now: Date): { from: string; to: string } {
  const today = bostonClock(now).date;
  return { from: addDays(today, -1), to: addDays(today, 2) };
}

// ---------------------------------------------------------------------------
// Event DMs (the task mutations)

/** A task's state before or after a create or update. */
export type TaskSnapshot = {
  status: string;
  /** "YYYY-MM-DD" */
  dueDate: string;
  ownerId: number;
  needsNewOwner: boolean;
};

export type EventReminder = {
  kind: EventReminderKind;
  recipientId: number;
};

/**
 * The DMs a create or an update sends right away, and whether it restarts the
 * scheduled reminders. `before` is null for a new task. `actorId` is whoever
 * made the change.
 *
 * - New task: "assigned" to the owner. Also when they made it themselves: it's
 *   their record of it, and the text says "You have a new task".
 * - New owner: "assigned" to them, and "no longer yours" to the previous
 *   owner. A new owner who also gets a new date gets only "assigned", which
 *   carries the date.
 * - New due date, same owner: "date changed" to the owner.
 * - Nobody is DMed about a change they made themselves, except "assigned".
 * - Nothing once the task is Done, or while it needs a new owner.
 *
 * `restartSchedule` is true when the owner or the due date changed, or the
 * task is new: the caller sets Task.remindersFrom to now.
 */
export function eventRemindersFor(
  before: TaskSnapshot | null,
  after: TaskSnapshot,
  actorId: number,
): { reminders: EventReminder[]; restartSchedule: boolean } {
  const ownerChanged = before !== null && before.ownerId !== after.ownerId;
  const dateChanged = before !== null && before.dueDate !== after.dueDate;
  const restartSchedule = before === null || ownerChanged || dateChanged;

  if (after.status === DONE || after.needsNewOwner) {
    return { reminders: [], restartSchedule };
  }

  const reminders: EventReminder[] = [];
  if (before === null || ownerChanged) {
    reminders.push({ kind: "ASSIGNED", recipientId: after.ownerId });
  }
  if (ownerChanged && before.ownerId !== actorId) {
    reminders.push({ kind: "REASSIGNED_AWAY", recipientId: before.ownerId });
  }
  if (dateChanged && !ownerChanged && after.ownerId !== actorId) {
    reminders.push({ kind: "DUE_DATE_CHANGED", recipientId: after.ownerId });
  }
  return { reminders, restartSchedule };
}

// ---------------------------------------------------------------------------
// Sending

/** A recorded reminder, as the sender checks it just before sending. */
export type RecordedReminder = {
  kind: ReminderKind;
  recipientId: number;
  /** "YYYY-MM-DD" */
  dueDate: string;
};

/** The task as it is when the sender gets to a reminder. */
export type CurrentTask = TaskSnapshot & { createdById: number };

const TO_OWNER = new Set<ReminderKind>([
  "ASSIGNED",
  "DUE_DATE_CHANGED",
  "DUE_SOON",
  "DUE_TODAY",
  "OVERDUE_OWNER",
]);

/**
 * Is a recorded reminder still true when it's time to send it (first try or a
 * retry)? If not, it's cancelled rather than sent.
 *
 * - Nothing goes out for a Done task, or one that needs a new owner.
 * - Anything meant for the owner, about a due date, needs that person to
 *   still be the owner and that date to still be the due date.
 * - "No longer yours" is dropped if the task came back to them.
 * - The creator's overdue note is dropped if the date moved.
 */
export function reminderStillWanted(
  reminder: RecordedReminder,
  task: CurrentTask,
): boolean {
  if (task.status === DONE || task.needsNewOwner) return false;
  if (reminder.kind === "REASSIGNED_AWAY") {
    return reminder.recipientId !== task.ownerId;
  }
  if (reminder.dueDate !== task.dueDate) return false;
  if (TO_OWNER.has(reminder.kind)) {
    return reminder.recipientId === task.ownerId;
  }
  // OVERDUE_CREATOR
  return reminder.recipientId === task.createdById;
}

/** What sendSlackDm resolves to when it fails (lib/tasks/slack.ts). */
export type FailedSend = {
  error: string;
  retryable: boolean;
  retryAfterSeconds?: number;
};

/**
 * Errors where the bot itself is broken (a revoked or wrong token, a missing
 * scope). slack.ts calls these not retryable, since a person has to fix
 * something, but the spec treats "the bot is broken" like Slack being down:
 * retried hourly for a day, which gives Hector that day to fix it.
 */
const BOT_BROKEN = new Set([
  "invalid_auth",
  "not_authed",
  "account_inactive",
  "token_revoked",
  "token_expired",
  "missing_scope",
  "not_allowed_token_type",
  "team_access_not_granted",
  "ekm_access_denied",
]);

export type AfterFailure =
  | { status: "PENDING"; nextAttemptAt: Date }
  | { status: "FAILED" }
  | { status: "SKIPPED" };

/**
 * What happens to a reminder whose send just failed.
 *
 * - No bot token (not_configured): SKIPPED, not a failure. Local runs and any
 *   deployment without Slack set up stay quiet.
 * - Slack down, rate limited, timed out, or the bot broken: tried again in
 *   about an hour (later if Slack asked us to wait), until a day has passed
 *   since the first try. Then FAILED.
 * - Anything about the person (user_not_found, a deactivated account, a bad
 *   ID): FAILED now. Waiting won't fix it; relinking them on Slack setup will,
 *   for their next reminder.
 *
 * FAILED is what shows "Reminder not delivered" on the task.
 */
export function afterFailedSend(
  result: FailedSend,
  firstAttemptAt: Date,
  now: Date,
): AfterFailure {
  if (result.error === "not_configured") return { status: "SKIPPED" };
  if (!result.retryable && !BOT_BROKEN.has(result.error)) {
    return { status: "FAILED" };
  }
  if (now.getTime() - firstAttemptAt.getTime() >= RETRY_FOR_MS) {
    return { status: "FAILED" };
  }
  const waitMs = Math.max(
    RETRY_AFTER_MS,
    (result.retryAfterSeconds ?? 0) * 1000,
  );
  return {
    status: "PENDING",
    nextAttemptAt: new Date(now.getTime() + waitMs),
  };
}

/** How many finished reminders the board reads per task for the badge. */
export const UNDELIVERED_LOOKBACK = 20;

/**
 * Does the task show "Reminder not delivered"? When, for its owner or its
 * creator, the most recent reminder that finished trying (sent or given up
 * on) was given up on. A later one that reaches that person clears it, and so
 * does marking the task Done. People no longer on the task (a previous owner
 * who wasn't told it's off their list) don't count: there's nothing left for
 * them to miss.
 *
 * `finished` is the task's SENT and FAILED reminders, newest first.
 */
export function isReminderUndelivered(
  task: { status: string; ownerId: number; createdById: number },
  finished: { status: string; recipientId: number }[],
): boolean {
  if (task.status === DONE) return false;
  const seen = new Set<number>();
  for (const r of finished) {
    if (r.recipientId !== task.ownerId && r.recipientId !== task.createdById) {
      continue;
    }
    if (seen.has(r.recipientId)) continue;
    seen.add(r.recipientId);
    if (r.status === "FAILED") return true;
  }
  return false;
}
