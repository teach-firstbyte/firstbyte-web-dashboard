import {
  AccountStatus,
  Prisma,
  Role,
  TaskReminderStatus,
  TaskStatus,
} from "@prisma/client";
import { prisma } from "@/server/db";
import { ServiceError } from "@/server/errors";
import { toDateOnly } from "@/server/validation";
import type { Viewer } from "@/server/viewer";
import { canManageSlackLinks } from "@/lib/auth/taskPolicy";
import { ownerName } from "@/lib/tasks/owners";
import {
  afterFailedSend,
  bostonClock,
  RETRY_AFTER_MS,
  STUCK_AFTER_MS,
} from "@/lib/tasks/reminders";
import { sendSlackDm } from "@/lib/tasks/slack";
import {
  buildWeeklySummary,
  DEFAULT_SUMMARY_SCHEDULE,
  nextSummary,
  summaryDueNow,
  weeklySummaryMessage,
  type SummarySchedule,
  type SummarySlot,
} from "@/lib/tasks/weekly-summary";
import { getTaskActor } from "./queries";
import { ownerNeedsReplacing, tasksUrl, type SendDm } from "./reminders";
import type { SummaryScheduleInput } from "./schema";
import { EBOARD_MEMBERSHIP_WHERE, EBOARD_USER_WHERE } from "./select";
import { slackMemberIdForDm } from "./slack-links";

/**
 * The weekly task summary (#139): a Slack DM to each super admin (the
 * president, VP and website lead) who is on the e-board and linked to Slack,
 * with what's overdue or due in the next 7 days by person, the tasks that
 * need a new owner, and who isn't connected to Slack.
 *
 * - When: the day and hour in task_settings (one row for the club, Monday 9am
 *   Boston time by default), changed by a super admin on Slack setup. The
 *   hourly cron job (/api/cron/task-reminders) calls runWeeklySummary.
 * - Once a week: each DM is a task_summaries row before it's sent, and the
 *   database refuses a second row for the same person and week (the Monday
 *   it starts on). A run that comes late, twice, or at the same time as
 *   another records it once. A row is sent only by whoever moves it from
 *   PENDING to SENDING, like a reminder (server/tasks/reminders.ts).
 * - Failures: retried hourly for a day, then FAILED, by the same rules as the
 *   reminders (afterFailedSend). No bot token means SKIPPED.
 *
 * The rules (when it's due, what it says) are pure functions in
 * lib/tasks/weekly-summary.ts, with their tests.
 */

const SETTINGS_ID = 1;

const FORBIDDEN_MESSAGE =
  "Only the president, VP and website lead can change the weekly summary.";

function dateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

// ---------------------------------------------------------------------------
// The setting

/** The club's summary day and hour, or the default if it was never set. */
export async function getSummarySchedule(): Promise<SummarySchedule> {
  const row = await prisma.taskSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: { summaryDay: true, summaryHour: true },
  });
  return row
    ? { day: row.summaryDay, hour: row.summaryHour }
    : DEFAULT_SUMMARY_SCHEDULE;
}

/** What the Slack setup page shows about the summary. */
export type SummarySetup = {
  schedule: SummarySchedule;
  /** The next one, Boston day and hour. `now`: it goes out with the next run. */
  next: SummarySlot & { now: boolean };
  /** Every super admin, and whether they get it. */
  recipients: { userId: number; name: string; getsIt: boolean }[];
};

async function assertSummaryAdmin(viewer: Viewer): Promise<void> {
  if (!canManageSlackLinks(await getTaskActor(viewer))) {
    throw new ServiceError("FORBIDDEN", FORBIDDEN_MESSAGE);
  }
}

/** The summary's setting, next send and recipients. Super admins only. */
export async function getSummarySetup(
  viewer: Viewer,
  now: Date = new Date(),
): Promise<SummarySetup> {
  await assertSummaryAdmin(viewer);
  const [schedule, last, admins] = await Promise.all([
    getSummarySchedule(),
    prisma.taskSummary.findFirst({
      orderBy: { weekOf: "desc" },
      select: { weekOf: true },
    }),
    prisma.user.findMany({
      where: { role: Role.SUPER_ADMIN, status: AccountStatus.APPROVED },
      select: {
        id: true,
        name: true,
        preferredName: true,
        slackLink: { select: { userId: true } },
        teamMemberships: {
          where: EBOARD_MEMBERSHIP_WHERE,
          select: { id: true },
          take: 1,
        },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
  ]);
  return {
    schedule,
    next: nextSummary(schedule, now, last ? toDateOnly(last.weekOf) : null),
    recipients: admins.map((a) => ({
      userId: a.id,
      name: ownerName(a),
      getsIt: a.slackLink !== null && a.teamMemberships.length > 0,
    })),
  };
}

/**
 * Changes when the summary goes out. Super admins only. The next one follows
 * it, but a week that already had its summary doesn't get a second.
 */
export async function setSummarySchedule(
  viewer: Viewer,
  input: SummaryScheduleInput,
): Promise<SummarySetup> {
  await assertSummaryAdmin(viewer);
  await prisma.taskSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      summaryDay: input.day,
      summaryHour: input.hour,
      updatedById: viewer.id,
    },
    update: {
      summaryDay: input.day,
      summaryHour: input.hour,
      updatedById: viewer.id,
    },
  });
  return getSummarySetup(viewer);
}

// ---------------------------------------------------------------------------
// Recording

/**
 * The summary's text, from the board as it is at `now`: every open task and
 * everyone on the e-board.
 */
export async function buildSummaryText(now: Date): Promise<string> {
  const [tasks, eboard] = await Promise.all([
    prisma.task.findMany({
      where: { status: { not: TaskStatus.DONE } },
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        ownerId: true,
        owner: {
          select: {
            name: true,
            preferredName: true,
            status: true,
            teamMemberships: {
              where: EBOARD_MEMBERSHIP_WHERE,
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: EBOARD_USER_WHERE,
      select: {
        id: true,
        name: true,
        preferredName: true,
        slackLink: { select: { userId: true } },
      },
    }),
  ]);

  const summary = buildWeeklySummary({
    today: bostonClock(now).date,
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      dueDate: toDateOnly(t.dueDate),
      ownerId: t.ownerId,
      ownerName: ownerName(t.owner),
      needsNewOwner: ownerNeedsReplacing(t.owner),
    })),
    eboard: eboard.map((p) => ({
      id: p.id,
      name: ownerName(p),
      slackConnected: p.slackLink !== null,
    })),
  });
  return weeklySummaryMessage(summary, tasksUrl()).text;
}

/**
 * Records this week's summary for each super admin who should get it and
 * hasn't, if one is due by `now`. Returns how many new rows there are.
 *
 * Only super admins on the e-board and linked to Slack get a row, so one who
 * is linked later, while it's still due, gets it on the next run.
 */
export async function queueWeeklySummary(now: Date): Promise<number> {
  const due = summaryDueNow(await getSummarySchedule(), now);
  if (!due) return 0;
  const weekOf = dateOnly(due.weekOf);

  const recipients = await prisma.user.findMany({
    where: {
      ...EBOARD_USER_WHERE,
      role: Role.SUPER_ADMIN,
      slackLink: { isNot: null },
      taskSummaries: { none: { weekOf } },
    },
    select: { id: true },
  });
  if (recipients.length === 0) return 0;

  const text = await buildSummaryText(now);
  const { count } = await prisma.taskSummary.createMany({
    data: recipients.map((r) => ({
      recipientId: r.id,
      weekOf,
      text,
      nextAttemptAt: now,
    })),
    // The unique key (recipient, week): a run at the same time as this one
    // has already recorded it, and this one adds nothing.
    skipDuplicates: true,
  });
  return count;
}

// ---------------------------------------------------------------------------
// Sending

export type SummaryCounts = {
  queued: number;
  stuck: number;
  sent: number;
  retrying: number;
  failed: number;
  skipped: number;
  cancelled: number;
  taken: number;
};

type Outcome = Exclude<keyof SummaryCounts, "queued" | "stuck">;

const deliverArgs = Prisma.validator<Prisma.TaskSummaryDefaultArgs>()({
  select: { id: true, recipientId: true, text: true, firstAttemptAt: true },
});

type DeliverRow = Prisma.TaskSummaryGetPayload<typeof deliverArgs>;

async function finish(
  id: number,
  status: TaskReminderStatus,
  now: Date,
  extra: Prisma.TaskSummaryUpdateManyMutationInput = {},
) {
  await prisma.taskSummary.updateMany({
    where: { id, status: TaskReminderStatus.SENDING },
    data: { status, finishedAt: now, claimedAt: null, ...extra },
  });
}

async function deliverOne(
  row: DeliverRow,
  now: Date,
  send: SendDm,
): Promise<Outcome> {
  // The claim. Only one caller can move a row out of PENDING.
  const claimed = await prisma.taskSummary.updateMany({
    where: { id: row.id, status: TaskReminderStatus.PENDING },
    data: { status: TaskReminderStatus.SENDING, claimedAt: now },
  });
  if (claimed.count !== 1) return "taken";

  let triedSlack = false;
  try {
    // No longer a super admin (or the account is gone): not theirs to read.
    const recipient = await prisma.user.findUnique({
      where: { id: row.recipientId },
      select: { role: true },
    });
    if (recipient?.role !== Role.SUPER_ADMIN) {
      await finish(row.id, TaskReminderStatus.CANCELLED, now);
      return "cancelled";
    }

    const memberId = await slackMemberIdForDm(row.recipientId);
    if (!memberId) {
      await finish(row.id, TaskReminderStatus.SKIPPED, now, {
        lastError: "not_linked",
      });
      return "skipped";
    }

    triedSlack = true;
    const result = await send(memberId, { text: row.text });
    const firstAttemptAt = row.firstAttemptAt ?? now;
    const attempt = { attempts: { increment: 1 }, firstAttemptAt };

    if (result.ok) {
      await finish(row.id, TaskReminderStatus.SENT, now, {
        ...attempt,
        lastError: null,
      });
      return "sent";
    }

    const next = afterFailedSend(result, firstAttemptAt, now);
    if (next.status === "PENDING") {
      await prisma.taskSummary.updateMany({
        where: { id: row.id, status: TaskReminderStatus.SENDING },
        data: {
          ...attempt,
          status: TaskReminderStatus.PENDING,
          claimedAt: null,
          nextAttemptAt: next.nextAttemptAt,
          lastError: result.error,
        },
      });
      return "retrying";
    }
    await finish(row.id, TaskReminderStatus[next.status], now, {
      ...attempt,
      lastError: result.error,
    });
    return next.status === "FAILED" ? "failed" : "skipped";
  } catch (error) {
    console.error(`[tasks/weekly-summary] Summary ${row.id} failed`, error);
    if (!triedSlack) {
      // Nothing reached Slack, so trying again later can't double it.
      await prisma.taskSummary
        .updateMany({
          where: { id: row.id, status: TaskReminderStatus.SENDING },
          data: {
            status: TaskReminderStatus.PENDING,
            claimedAt: null,
            nextAttemptAt: new Date(now.getTime() + RETRY_AFTER_MS),
          },
        })
        .catch(() => {});
      return "retrying";
    }
    // Slack may have it. Left in SENDING, giveUpOnStuckSummaries marks it
    // FAILED rather than sending it twice.
    return "failed";
  }
}

/** Rows left in SENDING by a sender that died mid-send: FAILED, not resent. */
async function giveUpOnStuckSummaries(now: Date): Promise<number> {
  const { count } = await prisma.taskSummary.updateMany({
    where: {
      status: TaskReminderStatus.SENDING,
      claimedAt: { lt: new Date(now.getTime() - STUCK_AFTER_MS) },
    },
    data: {
      status: TaskReminderStatus.FAILED,
      finishedAt: now,
      lastError: "interrupted",
    },
  });
  return count;
}

/**
 * The hourly job's part for the summary: give up on stuck sends, record this
 * week's summary if it's due, then send every one that's waiting (new ones
 * and retries). Safe to run twice, or twice at once.
 */
export async function runWeeklySummary(
  options: { now?: Date; send?: SendDm } = {},
): Promise<SummaryCounts> {
  const now = options.now ?? new Date();
  const send = options.send ?? sendSlackDm;
  const stuck = await giveUpOnStuckSummaries(now);
  const queued = await queueWeeklySummary(now);

  const rows = await prisma.taskSummary.findMany({
    ...deliverArgs,
    where: {
      status: TaskReminderStatus.PENDING,
      nextAttemptAt: { lte: now },
    },
    orderBy: { id: "asc" },
    take: 50,
  });

  const counts: SummaryCounts = {
    queued,
    stuck,
    sent: 0,
    retrying: 0,
    failed: 0,
    skipped: 0,
    cancelled: 0,
    taken: 0,
  };
  for (const row of rows) {
    counts[await deliverOne(row, now, send)] += 1;
  }
  return counts;
}
