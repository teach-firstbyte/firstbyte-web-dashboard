import { MeetingType } from "@prisma/client";
import { prisma } from "@/server/db";
import { ServiceError } from "@/server/errors";
import type { Viewer } from "@/server/viewer";
import {
  canDeleteTask,
  canUpdateTaskFields,
  type TaskActor,
  type TaskParties,
} from "@/lib/auth/taskPolicy";
import {
  assertTaskAccess,
  getTaskRow,
  isOnEboard,
  viewTaskRow,
  type TaskView,
} from "./queries";
import { taskRowArgs } from "./select";
import type { CreateTaskInput, UpdateTaskInput } from "./schema";

/**
 * Creates a task. Any e-board member or super admin may, and they become its
 * creator, which is what later lets them edit or delete it.
 */
export async function createTask(
  viewer: Viewer,
  input: CreateTaskInput,
): Promise<TaskView> {
  const actor = await assertTaskAccess(viewer);

  await assertEligibleOwner(input.ownerId);
  await assertLinksExist(input);

  const row = await prisma.task.create({
    ...taskRowArgs,
    data: { ...input, createdById: viewer.id },
  });
  return viewTaskRow(row, actor);
}

/**
 * Applies the fields a PATCH provided and leaves the rest alone.
 *
 * Who may send which fields is canUpdateTaskFields: the owner sends status
 * only; the creator and super admins send anything.
 */
export async function updateTask(
  viewer: Viewer,
  taskId: number,
  input: UpdateTaskInput,
): Promise<TaskView> {
  const actor = await assertTaskAccess(viewer);
  const task = await getTaskRow(taskId);

  if (!canUpdateTaskFields(actor, task, Object.keys(input))) {
    throw new ServiceError("FORBIDDEN", refusal(actor, task));
  }

  // Leaving the owner as it is stays allowed even if they have since left the
  // e-board, so the creator can still fix a typo in the title.
  if (input.ownerId !== undefined && input.ownerId !== task.ownerId) {
    await assertEligibleOwner(input.ownerId);
  }
  await assertLinksExist(input);

  const row = await prisma.task.update({
    ...taskRowArgs,
    where: { id: taskId },
    data: input,
  });
  return viewTaskRow(row, actor);
}

/** Deletes a task. The creator or a super admin only. Throws NOT_FOUND. */
export async function deleteTask(viewer: Viewer, taskId: number) {
  const actor = await assertTaskAccess(viewer);
  const task = await getTaskRow(taskId);

  if (!canDeleteTask(actor, task)) {
    throw new ServiceError(
      "FORBIDDEN",
      "Only the task's creator or a super admin can delete it.",
    );
  }

  await prisma.task.delete({ where: { id: taskId } });
  return { id: taskId };
}

/** The sentence for a refused update, so the owner learns what they *can* do. */
function refusal(actor: TaskActor, task: TaskParties): string {
  return actor.id === task.ownerId
    ? "As the owner you can change the status. Ask the creator or a super admin to change anything else."
    : "Only the task's owner can change its status, and only its creator or a super admin can change anything else.";
}

/** A task's owner must be on the e-board. Throws INVALID. */
async function assertEligibleOwner(userId: number) {
  if (!(await isOnEboard(userId))) {
    throw new ServiceError(
      "INVALID",
      "The owner must be an approved e-board member.",
    );
  }
}

/**
 * Checked up front so a bad id is a 400 with a sentence, rather than a P2003
 * foreign-key violation surfacing as "Failed to create task".
 */
async function assertLinksExist(input: {
  teamId?: number | null;
  meetingId?: number | null;
}) {
  if (input.teamId != null) {
    const team = await prisma.team.findUnique({
      where: { id: input.teamId },
      select: { id: true },
    });
    if (!team) throw new ServiceError("INVALID", "That team does not exist");
  }

  if (input.meetingId != null) {
    const meeting = await prisma.meeting.findUnique({
      where: { id: input.meetingId },
      select: { type: true },
    });
    if (!meeting) {
      throw new ServiceError("INVALID", "That meeting does not exist");
    }
    if (meeting.type !== MeetingType.EBOARD_MEETING) {
      throw new ServiceError(
        "INVALID",
        "A task can only link to an e-board meeting.",
      );
    }
  }
}
