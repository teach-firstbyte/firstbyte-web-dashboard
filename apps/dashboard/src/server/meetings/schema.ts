import { MeetingType } from "@prisma/client";
import { z } from "zod";
import { dateField, nullableIdParam, nullableText } from "@/server/validation";

/**
 * Error messages are spelled out to match what the routes returned before this
 * layer existed. MeetingsTable shows `data.error` verbatim, so a reworded
 * message is a user-visible change even though no code depends on it.
 */
const meetingType = z.enum(MeetingType, {
  error: `Invalid type. Must be one of: ${Object.values(MeetingType).join(", ")}`,
});

const REQUIRED = "title, type, and scheduledAt are required";

export const createMeetingSchema = z.object({
  // The `error` option covers a missing key; .min covers a present-but-blank
  // one. Without the first, an omitted title reports zod's default, "expected
  // string, received undefined", which is not a sentence to show an officer.
  title: z.string({ error: REQUIRED }).trim().min(1, REQUIRED),
  type: meetingType,
  scheduledAt: dateField,
  description: nullableText,
  teamId: nullableIdParam,
  location: nullableText,
  isRequired: z.boolean().default(false),
  maxCapacity: nullableIdParam,
});

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;

/**
 * Every field optional: a PUT writes only what it is given.
 *
 * startedAt and endedAt accept null, because clearing them is meaningful --
 * that is how a meeting is marked as not started. scheduledAt does not, because
 * the column is required.
 */
export const updateMeetingSchema = z
  .object({
    title: z.string().trim().min(1, "title cannot be empty"),
    type: meetingType,
    scheduledAt: dateField,
    startedAt: dateField.nullable(),
    endedAt: dateField.nullable(),
    description: nullableText,
    teamId: nullableIdParam,
    location: nullableText,
    isRequired: z.boolean(),
    maxCapacity: nullableIdParam,
  })
  .partial()
  .refine(
    (v) => Object.keys(v).length > 0,
    "Provide at least one field to update",
  );

export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;
