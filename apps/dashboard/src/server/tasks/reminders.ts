import {
  AccountStatus,
  Prisma,
  TaskReminderStatus,
  TaskStatus,
} from "@prisma/client";
import { prisma } from "@/server/db";
import { toDateOnly } from "@/server/validation";
import type { Viewer } from "@/server/viewer";
import { TASK_STATUS_OPTIONS } from "@/lib/enums";
import { formatIsoDate } from "@/lib/format";
import { withBasePath } from "@/lib/paths";
import { ownerName } from "@/lib/tasks/owners";
import {
  afterFailedSend,
  dueDateWindow,
  eventRemindersFor,
  reminderStillWanted,
  RETRY_AFTER_MS,
  scheduledRemindersDue,
  STUCK_AFTER_MS,
  type EventReminder,
  type PlannedReminder,
  type TaskSnapshot,
} from "@/lib/tasks/reminders";
import { sendSlackDm, type SlackDmResult } from "@/lib/tasks/slack";
import {
  taskAssignedMessage,
  taskDueDateChangedMessage,
  taskDueSoonMessage,
  taskDueTodayMessage,
  taskOverdueCreatorMessage,
  taskOverdueOwnerMessage,
  taskReassignedAwayMessage,
} from "@/lib/tasks/slack-messages";
import { EBOARD_MEMBERSHIP_WHERE, type TaskRow } from "./select";
import { slackMemberIdForDm } from "./slack-links";

/**
 * Task reminders: Slack DMs from the FirstByte Tasks bot (#138).
 *
 * Every DM is a row in task_reminders before anything is sent. Two writers
 * record them:
 *
 * - The task mutations record the event DMs (assigned, due date changed, no
 *   longer yours) in the same transaction as the change. The task routes then
 *   send them right after the response (deliverRemindersForTask, with Next's
 *   after()).
 * - The hourly cron job (runTaskReminders) records the scheduled ones (2 days
 *   before, due today, 1 day overdue), and sends everything still waiting:
 *   its own, event DMs whose after() send never ran, and retries.
 *
 * Sending exactly once comes from the database, not from timing:
 * - A reminder can only be recorded once. Its unique key is task, kind,
 *   recipient, due date and (for event DMs) the time of the change, and the
 *   job inserts with ON CONFLICT DO NOTHING. Two runs in the same hour, or two
 *   at once, record one row.
 * - A row is sent only by the caller that moves it from PENDING to SENDING in
 *   one conditional UPDATE. Anyone else finds it taken and moves on.
 * - A row stuck in SENDING (the function died mid-send) is marked FAILED, not
 *   retried, because Slack may already have delivered it.
 *
 * Who gets nothing: anyone not linked to Slack or off the e-board (SKIPPED,
 * not a failure), everyone once a task is Done or needs a new owner
 * (CANCELLED), and everyone when TASKS_SLACK_BOT_TOKEN isn't set (SKIPPED).
 * The pure rules are in lib/tasks/reminders.ts, with their tests.
 */

/** Sends one DM. sendSlackDm, or a fake in a test run. */
export type SendDm = (
  memberId: string,
  message: { text: string },
) => Promise<SlackDmResult>;

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Message details

/** Where "Open in dashboard" goes. Absolute: it leaves the app in a DM. */
export function tasksUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const vercel = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
  const origin = configured
    ? configured.replace(/\/$/, "")
    : vercel
      ? `https://${vercel}`
      : "http://localhost:3000";
  return `${origin}${withBasePath("/tasks")}`;
}

type Person = { name: string | null; preferredName: string | null };

/** "Maya", for "Maya assigned you a task". */
function firstName(p: Person): string {
  return p.preferredName?.trim() || ownerName(p).split(/\s+/)[0];
}

function statusLabel(status: TaskStatus): string {
  return TASK_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "To do";
}

/** A task's owner needs replacing: off the e-board, or account gone. */
export function ownerNeedsReplacing(owner: {
  status: string;
  teamMemberships: unknown[];
}): boolean {
  return (
    owner.status !== AccountStatus.APPROVED ||
    owner.teamMemberships.length === 0
  );
}

function snapshot(row: TaskRow): TaskSnapshot {
  return {
    status: row.status,
    dueDate: toDateOnly(row.dueDate),
    ownerId: row.ownerId,
    needsNewOwner: ownerNeedsReplacing(row.owner),
  };
}

// ---------------------------------------------------------------------------
// Event DMs, from the task mutations

/**
 * What a create or update means for reminders, worked out before it's
 * written: the DMs to send and whether the schedule restarts (the caller then
 * sets remindersFrom). `before` is null for a new task.
 */
export function planTaskEvents(
  before: TaskRow | null,
  after: {
    status: TaskStatus;
    dueDate: Date;
    ownerId: number;
  },
  actor: Viewer,
): ReturnType<typeof eventRemindersFor> {
  const beforeSnap = before ? snapshot(before) : null;
  const ownerChanged = before !== null && before.ownerId !== after.ownerId;
  return eventRemindersFor(
    beforeSnap,
    {
      status: after.status,
      dueDate: toDateOnly(after.dueDate),
      ownerId: after.ownerId,
      // A new owner passed assertEligibleOwner, so they're on the e-board.
      needsNewOwner:
        beforeSnap !== null && !ownerChanged ? beforeSnap.needsNewOwner : false,
    },
    actor.id,
  );
}

/**
 * Records the event DMs a mutation decided on, inside its transaction. `at`
 * is the time of the change: it's each row's event key, so a later change can
 * DM the same person again. The route then sends them
 * (deliverRemindersForTask).
 */
export async function recordEventReminders(
  tx: Tx,
  input: {
    reminders: EventReminder[];
    before: TaskRow | null;
    after: TaskRow;
    actor: Viewer;
    at: Date;
  },
): Promise<void> {
  const { reminders, before, after, actor, at } = input;
  if (reminders.length === 0) return;

  const url = tasksUrl();
  const dueDate = toDateOnly(after.dueDate);
  const textFor = (r: EventReminder): string => {
    switch (r.kind) {
      case "ASSIGNED":
        return taskAssignedMessage({
          title: after.title,
          dueDate,
          assignedByName: actor.id === after.ownerId ? null : firstName(actor),
          team: after.team?.name ?? null,
          meetingDate: after.meeting
            ? formatIsoDate(after.meeting.scheduledAt)
            : null,
          url,
        }).text;
      case "DUE_DATE_CHANGED":
        return taskDueDateChangedMessage({
          title: after.title,
          oldDueDate: before ? toDateOnly(before.dueDate) : dueDate,
          newDueDate: dueDate,
          changedByName: firstName(actor),
          url,
        }).text;
      case "REASSIGNED_AWAY":
        return taskReassignedAwayMessage({
          title: after.title,
          newOwnerName: ownerName(after.owner),
          reassignedByName: firstName(actor),
        }).text;
    }
  };

  await tx.taskReminder.createMany({
    data: reminders.map((r) => ({
      taskId: after.id,
      kind: r.kind,
      recipientId: r.recipientId,
      dueDate: after.dueDate,
      eventKey: at.toISOString(),
      text: textFor(r),
      nextAttemptAt: at,
    })),
    skipDuplicates: true,
  });
}

/**
 * Sends a task's waiting DMs now: the event DMs its create or update just
 * recorded (and any retry of its that happens to be due). The task routes
 * call this with Next's after(), once the response has gone, so saving a task
 * never waits on Slack. If it never runs, the next hourly run sends them, and
 * the claim in deliverOne means they go out once either way. Never throws.
 */
export async function deliverRemindersForTask(taskId: number): Promise<void> {
  try {
    await deliverTaskReminders({ taskId });
  } catch (error) {
    console.error(
      `[tasks/reminders] Sending task ${taskId}'s DMs failed`,
      error,
    );
  }
}

// ---------------------------------------------------------------------------
// Scheduled reminders, from the hourly job

const scheduleTaskArgs = Prisma.validator<Prisma.TaskDefaultArgs>()({
  select: {
    id: true,
    title: true,
    status: true,
    dueDate: true,
    ownerId: true,
    createdById: true,
    remindersFrom: true,
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
        slackLink: { select: { userId: true } },
      },
    },
    createdBy: {
      select: {
        name: true,
        preferredName: true,
        slackLink: { select: { userId: true } },
      },
    },
  },
});

type ScheduleTask = Prisma.TaskGetPayload<typeof scheduleTaskArgs>;

function scheduledText(task: ScheduleTask, r: PlannedReminder): string {
  const url = tasksUrl();
  const dueDate = toDateOnly(task.dueDate);
  switch (r.kind) {
    case "DUE_SOON":
      return taskDueSoonMessage({
        title: task.title,
        dueDate,
        statusLabel: statusLabel(task.status),
        url,
      }).text;
    case "DUE_TODAY":
      return taskDueTodayMessage({
        title: task.title,
        statusLabel: statusLabel(task.status),
        url,
      }).text;
    case "OVERDUE_OWNER":
      return taskOverdueOwnerMessage({
        title: task.title,
        dueDate,
        creatorName:
          task.createdById === task.ownerId ? null : firstName(task.createdBy),
        url,
      }).text;
    case "OVERDUE_CREATOR":
      return taskOverdueCreatorMessage({
        title: task.title,
        ownerName: ownerName(task.owner),
        url,
      }).text;
  }
}

function dateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/**
 * Records the scheduled reminders due by `now` that aren't recorded yet.
 * Returns how many new rows there are.
 *
 * Someone not linked to Slack gets no row at all, so if Hector links them
 * later the same day, that day's reminder still reaches them on the next run.
 */
export async function queueScheduledReminders(now: Date): Promise<number> {
  const window = dueDateWindow(now);
  const tasks = await prisma.task.findMany({
    ...scheduleTaskArgs,
    where: {
      status: { not: TaskStatus.DONE },
      dueDate: { gte: dateOnly(window.from), lte: dateOnly(window.to) },
    },
  });

  const data: Prisma.TaskReminderCreateManyInput[] = [];
  for (const task of tasks) {
    const planned = scheduledRemindersDue(
      {
        status: task.status,
        dueDate: toDateOnly(task.dueDate),
        ownerId: task.ownerId,
        createdById: task.createdById,
        needsNewOwner: ownerNeedsReplacing(task.owner),
        remindersFrom: task.remindersFrom,
      },
      now,
    );
    for (const r of planned) {
      const linked =
        r.recipientId === task.ownerId
          ? task.owner.slackLink !== null
          : task.createdBy.slackLink !== null;
      if (!linked) continue;
      data.push({
        taskId: task.id,
        kind: r.kind,
        recipientId: r.recipientId,
        dueDate: task.dueDate,
        eventKey: "",
        text: scheduledText(task, r),
        nextAttemptAt: now,
      });
    }
  }
  if (data.length === 0) return 0;

  const { count } = await prisma.taskReminder.createMany({
    data,
    skipDuplicates: true,
  });
  return count;
}

// ---------------------------------------------------------------------------
// Sending

export type DeliveryCounts = {
  sent: number;
  retrying: number;
  failed: number;
  skipped: number;
  cancelled: number;
  /** Someone else claimed it first. */
  taken: number;
};

type Outcome = keyof DeliveryCounts;

const deliverArgs = Prisma.validator<Prisma.TaskReminderDefaultArgs>()({
  select: {
    id: true,
    taskId: true,
    kind: true,
    recipientId: true,
    dueDate: true,
    text: true,
    firstAttemptAt: true,
  },
});

type DeliverRow = Prisma.TaskReminderGetPayload<typeof deliverArgs>;

/**
 * Sends reminders that are waiting: PENDING with nextAttemptAt passed.
 * `taskId` limits it to one task's (the event DMs a mutation just recorded).
 */
export async function deliverTaskReminders(
  options: {
    taskId?: number;
    now?: Date;
    send?: SendDm;
    limit?: number;
  } = {},
): Promise<DeliveryCounts> {
  const now = options.now ?? new Date();
  const send = options.send ?? sendSlackDm;
  const rows = await prisma.taskReminder.findMany({
    ...deliverArgs,
    where: {
      status: TaskReminderStatus.PENDING,
      nextAttemptAt: { lte: now },
      ...(options.taskId !== undefined ? { taskId: options.taskId } : {}),
    },
    orderBy: { id: "asc" },
    take: options.limit ?? 200,
  });

  const counts: DeliveryCounts = {
    sent: 0,
    retrying: 0,
    failed: 0,
    skipped: 0,
    cancelled: 0,
    taken: 0,
  };
  // One at a time: a handful per hour, and Slack rate-limits bursts.
  for (const row of rows) {
    counts[await deliverOne(row, now, send)] += 1;
  }
  return counts;
}

async function finish(
  id: number,
  status: TaskReminderStatus,
  now: Date,
  extra: Prisma.TaskReminderUpdateManyMutationInput = {},
) {
  await prisma.taskReminder.updateMany({
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
  const claimed = await prisma.taskReminder.updateMany({
    where: { id: row.id, status: TaskReminderStatus.PENDING },
    data: { status: TaskReminderStatus.SENDING, claimedAt: now },
  });
  if (claimed.count !== 1) return "taken";

  let triedSlack = false;
  try {
    const task = await prisma.task.findUnique({
      where: { id: row.taskId },
      select: {
        status: true,
        dueDate: true,
        ownerId: true,
        createdById: true,
        owner: {
          select: {
            status: true,
            teamMemberships: {
              where: EBOARD_MEMBERSHIP_WHERE,
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });
    const wanted =
      task !== null &&
      reminderStillWanted(
        {
          kind: row.kind,
          recipientId: row.recipientId,
          dueDate: toDateOnly(row.dueDate),
        },
        {
          status: task.status,
          dueDate: toDateOnly(task.dueDate),
          ownerId: task.ownerId,
          createdById: task.createdById,
          needsNewOwner: ownerNeedsReplacing(task.owner),
        },
      );
    if (!wanted) {
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
      await prisma.taskReminder.updateMany({
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
    console.error(`[tasks/reminders] Reminder ${row.id} failed`, error);
    if (!triedSlack) {
      // Nothing reached Slack, so trying again later can't double it.
      await prisma.taskReminder
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
    // Slack may have it. Left in SENDING, giveUpOnStuck marks it FAILED.
    return "failed";
  }
}

/**
 * Rows left in SENDING by a sender that died mid-send. Marked FAILED (the
 * task shows "Reminder not delivered"), never sent again: Slack may have
 * delivered it, and a missed DM beats a doubled one.
 */
export async function giveUpOnStuck(now: Date): Promise<number> {
  const { count } = await prisma.taskReminder.updateMany({
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
 * The hourly job: give up on stuck sends, record the scheduled reminders due
 * by now, then send everything waiting. Safe to run twice, or twice at once.
 */
export async function runTaskReminders(
  options: { now?: Date; send?: SendDm } = {},
) {
  const now = options.now ?? new Date();
  const stuck = await giveUpOnStuck(now);
  const queued = await queueScheduledReminders(now);
  const delivered = await deliverTaskReminders({ now, send: options.send });
  return { queued, stuck, ...delivered };
}
