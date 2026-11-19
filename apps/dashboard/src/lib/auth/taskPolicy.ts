/**
 * Who may see and change e-board tasks.
 *
 * Every rule is a plain function over facts the server has already looked up
 * (see getTaskActor in server/tasks/queries.ts), for two reasons:
 *
 *   - The board (#135) can show or hide a button with the same line the
 *     server enforces, so the two can't disagree. Same idea as
 *     lib/auth/teamPolicy.ts, and the same no-@prisma/client rule applies.
 *   - It has no runtime imports, so `node --test` loads it as it is.
 *     taskPolicy.test.ts covers every rule here. Keep it import-free.
 *
 * The rules:
 *   - Only approved EBOARD members and super admins can read or write tasks.
 *   - The owner can change the status, and nothing else.
 *   - The creator or a super admin can change anything, and delete the task.
 *   - Any other e-board member can read tasks and create new ones.
 */

/** The facts about the person asking. Built only by getTaskActor. */
export type TaskActor = {
  id: number;
  isSuperAdmin: boolean;
  /** An APPROVED membership of the EBOARD team, on an APPROVED account. */
  isEboardMember: boolean;
};

/** The two fields of a task the rules read. */
export type TaskParties = { ownerId: number; createdById: number };

/** May this person open Tasks at all? Gates every read and write. */
export function canAccessTasks(
  actor: Pick<TaskActor, "isSuperAdmin" | "isEboardMember">,
): boolean {
  return actor.isSuperAdmin || actor.isEboardMember;
}

/** Title, owner, due date, team, meeting, notes, and delete. */
export function canEditTask(actor: TaskActor, task: TaskParties): boolean {
  return (
    canAccessTasks(actor) &&
    (actor.isSuperAdmin || actor.id === task.createdById)
  );
}

/** Status only. Everyone who can edit, plus the owner. */
export function canChangeTaskStatus(
  actor: TaskActor,
  task: TaskParties,
): boolean {
  return (
    canEditTask(actor, task) ||
    (canAccessTasks(actor) && actor.id === task.ownerId)
  );
}

/** Deleting follows the edit rule. Named so a caller reads as what it does. */
export const canDeleteTask = canEditTask;

/**
 * May this person write this set of fields to this task?
 *
 * A change that touches only `status` needs canChangeTaskStatus; anything
 * else needs canEditTask. Checked on the keys that are present, not on
 * whether their values differ, so an owner sending back the unchanged title
 * is refused rather than quietly allowed.
 */
export function canUpdateTaskFields(
  actor: TaskActor,
  task: TaskParties,
  fields: readonly string[],
): boolean {
  const statusOnly = fields.every((f) => f === "status");
  return statusOnly
    ? canChangeTaskStatus(actor, task)
    : canEditTask(actor, task);
}

/** What the viewer may do with one task, for the board's buttons. */
export function taskPermissions(actor: TaskActor, task: TaskParties) {
  return {
    changeStatus: canChangeTaskStatus(actor, task),
    edit: canEditTask(actor, task),
    delete: canDeleteTask(actor, task),
  };
}

export type TaskPermissions = ReturnType<typeof taskPermissions>;

/**
 * May this person see and change e-board members' Slack links (/tasks/slack)?
 * Super admins only: the president, VP and website lead. A member ID is never
 * shown to anyone else, not even the person it belongs to.
 */
export function canManageSlackLinks(
  actor: Pick<TaskActor, "isSuperAdmin">,
): boolean {
  return actor.isSuperAdmin;
}
