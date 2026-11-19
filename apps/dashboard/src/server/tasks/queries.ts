import { AccountStatus, TaskStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { ServiceError } from "@/server/errors";
import { toDateOnly } from "@/server/validation";
import type { Viewer } from "@/server/viewer";
import { formatIsoDate } from "@/lib/format";
import { isSuperAdmin } from "@/lib/auth/roles";
import {
  canAccessTasks,
  taskPermissions,
  type TaskActor,
  type TaskPermissions,
} from "@/lib/auth/taskPolicy";
import {
  EBOARD_USER_WHERE,
  taskOwnerOptionArgs,
  taskRowArgs,
  toTaskOwnerOption,
  type TaskOwnerOption,
  type TaskRow,
} from "./select";
import type { ListTasksInput } from "./schema";

/**
 * The facts the task rules need about the person asking.
 *
 * The one place TaskActor is built. Every task read and write starts here, so
 * a caller that skipped the route's gate (a server action, a script) still
 * gets the same answer.
 */
export async function getTaskActor(viewer: Viewer): Promise<TaskActor> {
  return {
    id: viewer.id,
    isSuperAdmin: isSuperAdmin(viewer),
    isEboardMember: await isOnEboard(viewer.id),
  };
}

/** An approved account with an approved EBOARD membership. */
export async function isOnEboard(userId: number): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { id: userId, ...EBOARD_USER_WHERE },
    select: { id: true },
  });
  return user !== null;
}

/**
 * Throws FORBIDDEN unless the person may open Tasks. Returns their facts so
 * the caller doesn't look them up twice.
 */
export async function assertTaskAccess(viewer: Viewer): Promise<TaskActor> {
  const actor = await getTaskActor(viewer);
  if (!canAccessTasks(actor)) {
    throw new ServiceError("FORBIDDEN", "Tasks are only for e-board members.");
  }
  return actor;
}

/**
 * A task as every reader gets it.
 *
 * - `dueDate` is "YYYY-MM-DD". It has no time, so there is no time zone to
 *   get wrong in the browser.
 * - `isOverdue`: the due date is before today in Boston and it isn't Done. Due
 *   today is not overdue yet.
 * - `needsNewOwner`: the owner is no longer an approved EBOARD member (they
 *   left, or deleted their account). Shown on the board, never stored.
 * - `owner.slackConnected`: whether the owner is linked to Slack. False means
 *   "Not connected to Slack" on the board, and no reminders.
 * - `can`: what this viewer may do with it, from lib/auth/taskPolicy.ts.
 */
export type TaskView = Omit<TaskRow, "dueDate" | "owner"> & {
  dueDate: string;
  owner: TaskOwnerOption;
  isOverdue: boolean;
  needsNewOwner: boolean;
  can: TaskPermissions;
};

/** Today's date in Boston, as "YYYY-MM-DD". */
export function clubToday(now: Date = new Date()): string {
  return formatIsoDate(now);
}

function toTaskView(row: TaskRow, actor: TaskActor, today: string): TaskView {
  const { owner, dueDate, ...rest } = row;
  const { status: accountStatus, teamMemberships, ...ownerRow } = owner;
  const due = toDateOnly(dueDate);

  return {
    ...rest,
    dueDate: due,
    owner: toTaskOwnerOption(ownerRow),
    isOverdue: row.status !== TaskStatus.DONE && due < today,
    needsNewOwner:
      accountStatus !== AccountStatus.APPROVED || teamMemberships.length === 0,
    can: taskPermissions(actor, row),
  };
}

/**
 * Every task the filters allow, soonest due first.
 *
 * Every e-board member sees every task: there is no per-person scoping, only
 * the access gate. Grouping (by owner or team) is the board's job.
 */
export async function listTasks(
  viewer: Viewer,
  filters: ListTasksInput = { includeDone: true },
): Promise<TaskView[]> {
  const actor = await assertTaskAccess(viewer);

  const where: Prisma.TaskWhereInput = {
    ...(filters.ownerId !== undefined ? { ownerId: filters.ownerId } : {}),
    ...(filters.includeDone ? {} : { status: { not: TaskStatus.DONE } }),
  };

  const rows = await prisma.task.findMany({
    ...taskRowArgs,
    where,
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
  });

  const today = clubToday();
  return rows.map((row) => toTaskView(row, actor, today));
}

/** One task. Throws NOT_FOUND, or FORBIDDEN for someone off the e-board. */
export async function getTask(viewer: Viewer, taskId: number) {
  const actor = await assertTaskAccess(viewer);
  return toTaskView(await getTaskRow(taskId), actor, clubToday());
}

/**
 * The raw row, with no access check. For mutations.ts, which has already
 * checked. Not for routes or pages.
 */
export async function getTaskRow(taskId: number): Promise<TaskRow> {
  const row = await prisma.task.findUnique({
    ...taskRowArgs,
    where: { id: taskId },
  });
  if (!row) throw new ServiceError("NOT_FOUND", "Task not found");
  return row;
}

/** A TaskView of a row a mutation just wrote. */
export function viewTaskRow(row: TaskRow, actor: TaskActor): TaskView {
  return toTaskView(row, actor, clubToday());
}

/**
 * Everyone who can be picked as an owner: approved EBOARD members, by name.
 * The same rule assertEligibleOwner enforces on writes.
 */
export async function listTaskOwnerOptions(
  viewer: Viewer,
): Promise<TaskOwnerOption[]> {
  await assertTaskAccess(viewer);
  const rows = await prisma.user.findMany({
    ...taskOwnerOptionArgs,
    where: EBOARD_USER_WHERE,
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return rows.map(toTaskOwnerOption);
}
