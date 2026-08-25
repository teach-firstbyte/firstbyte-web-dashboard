import { prisma } from "@/server/db";
import { hasAttended } from "@/server/attendance/queries";
import { ServiceError } from "@/server/errors";
import type { Viewer } from "@/server/viewer";
import { hasFeedbackFor } from "./queries";
import type { CreateFeedbackInput, UpdateFeedbackInput } from "./schema";

/**
 * Records one person's feedback on one meeting.
 *
 * Both rules live here rather than at the call site:
 *   you must have attended  -- REGISTERED is not enough, signing up for a
 *                              meeting is not the same as going to it
 *   one per meeting         -- app-level only, there is no unique constraint
 *
 * The author is always the viewer. It is never read from the request, or
 * anyone could file feedback under someone else's name -- on the one feature
 * where authorship is the entire point.
 */
export async function createFeedback(
  viewer: Viewer,
  input: CreateFeedbackInput,
) {
  if (!(await hasAttended(viewer.id, input.meetingId))) {
    throw new ServiceError("FORBIDDEN", "You haven't attended this meeting.");
  }

  if (await hasFeedbackFor(viewer.id, input.meetingId)) {
    throw new ServiceError(
      "CONFLICT",
      "You've already left feedback for this meeting.",
    );
  }

  return prisma.feedback.create({
    data: { ...input, authorId: viewer.id },
  });
}

/** Throws NOT_FOUND rather than letting Prisma raise P2025 as a 500. */
async function getFeedbackRow(feedbackId: number) {
  const row = await prisma.feedback.findUnique({ where: { id: feedbackId } });
  if (!row) throw new ServiceError("NOT_FOUND", "Feedback not found");
  return row;
}

/**
 * Applies the fields a PUT provided. Officer-only, gated at the route.
 *
 * zod's .partial() already dropped absent keys, so the parsed object goes
 * straight to Prisma -- that is what replaced the four hand-written
 * `...(x !== undefined ? { x } : {})` spreads.
 */
export async function updateFeedback(
  feedbackId: number,
  input: UpdateFeedbackInput,
) {
  await getFeedbackRow(feedbackId);

  return prisma.feedback.update({ where: { id: feedbackId }, data: input });
}

/** Deletes one feedback row. Throws NOT_FOUND. */
export async function deleteFeedback(feedbackId: number) {
  const row = await getFeedbackRow(feedbackId);
  await prisma.feedback.delete({ where: { id: feedbackId } });
  return row;
}
