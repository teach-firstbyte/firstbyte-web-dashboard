import { TaskStatus } from "@prisma/client";
import { z } from "zod";
import {
  dateOnlyField,
  idParam,
  nullableIdParam,
  nullableText,
} from "@/server/validation";

const taskStatus = z.enum(TaskStatus, {
  error: `Invalid status. Must be one of: ${Object.values(TaskStatus).join(", ")}`,
});

const REQUIRED = "title, ownerId, and dueDate are required";

// Long enough for any action item, short enough that a pasted paragraph is
// caught. The board shows the title on one line.
const title = z.string({ error: REQUIRED }).trim().min(1, REQUIRED).max(200);
const notes = nullableText.refine(
  (v) => v === null || v.length <= 5000,
  "notes must be 5000 characters or fewer",
);

/**
 * A new task. The creator is whoever is signed in, never a field: a body that
 * names its own creator could hand edit rights to someone else.
 */
export const createTaskSchema = z.object({
  title,
  ownerId: idParam,
  dueDate: dateOnlyField,
  status: taskStatus.default(TaskStatus.TODO),
  teamId: nullableIdParam,
  meetingId: nullableIdParam,
  notes,
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/**
 * Every field optional: a PATCH writes only what it is given. Which fields
 * the caller may send depends on who they are -- see canUpdateTaskFields.
 */
export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1, "title cannot be empty").max(200),
    ownerId: idParam,
    dueDate: dateOnlyField,
    status: taskStatus,
    teamId: nullableIdParam,
    meetingId: nullableIdParam,
    notes,
  })
  .partial()
  .refine(
    (v) => Object.keys(v).length > 0,
    "Provide at least one field to update",
  );

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/** GET /api/tasks filters. All optional. */
export const listTasksSchema = z.object({
  ownerId: idParam.optional(),
  // The tasks that came from one meeting, for its Action items section.
  meetingId: idParam.optional(),
  // A query string, so "false" arrives as text. Anything but "false" keeps
  // Done tasks in.
  includeDone: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
});

export type ListTasksInput = z.infer<typeof listTasksSchema>;

/**
 * PUT /api/tasks/slack/[userId]. Only the type is checked here: the format
 * check is normalizeSlackMemberId's, in server/tasks/slack-links.ts, so the
 * message matches the setup form's.
 */
export const slackLinkSchema = z.object({
  slackUserId: z.string({ error: "slackUserId is required" }).max(64),
});

export type SlackLinkInput = z.infer<typeof slackLinkSchema>;
